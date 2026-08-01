/**
 * Lecture de fichiers bancaires dans le navigateur (§9, §21).
 *
 * Le fichier n'est jamais envoyé au serveur : il est lu et analysé
 * intégralement côté client. Seules les opérations validées par l'utilisateur
 * sont ensuite transmises, via les Server Actions habituelles.
 *
 * Les deux lecteurs (CSV, XLSX) exposent la même forme de résultat, pour que
 * le reste de l'assistant d'import n'ait pas à connaître le format d'origine.
 */

export type ParsedSheet = {
  /** Toutes les lignes du fichier, y compris la première si elle est un en-tête. */
  rows: string[][]
  /** Nombre de colonnes de la ligne la plus longue. */
  columnCount: number
}

export type FileReadError = {
  code: 'empty' | 'too_large' | 'unreadable' | 'unsupported_type'
  message: string
}

export type FileReadResult =
  | { success: true; sheet: ParsedSheet }
  | { success: false; error: FileReadError }

/** Taille maximale acceptée : au-delà, le navigateur devient poussif. */
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 Mo

/** Convertit toutes les cellules d'une grille en chaînes, sans jamais lever. */
function toStringGrid(rows: readonly unknown[][]): string[][] {
  return rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return ''
      if (cell instanceof Date) return cell.toISOString().slice(0, 10)
      return String(cell)
    }),
  )
}

function longestRowLength(rows: readonly string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0)
}

/**
 * Lit un fichier CSV.
 *
 * Papa Parse est importé statiquement : c'est une bibliothèque légère, à
 * l'inverse d'ExcelJS ci-dessous.
 */
export async function readCsvFile(file: File): Promise<FileReadResult> {
  if (file.size === 0) {
    return { success: false, error: { code: 'empty', message: 'Ce fichier est vide.' } }
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: { code: 'too_large', message: 'Ce fichier dépasse 20 Mo. Réduisez la période exportée.' },
    }
  }

  const Papa = await import('papaparse')

  return new Promise((resolve) => {
    Papa.default.parse<string[]>(file, {
      // Le séparateur est déduit automatiquement : virgule, point-virgule ou
      // tabulation selon l'export bancaire, la plupart utilisant le point-virgule.
      delimiter: '',
      skipEmptyLines: 'greedy',
      complete: (result) => {
        const rows = toStringGrid(result.data)
        if (rows.length === 0) {
          resolve({
            success: false,
            error: { code: 'empty', message: 'Aucune ligne exploitable dans ce fichier.' },
          })
          return
        }
        resolve({ success: true, sheet: { rows, columnCount: longestRowLength(rows) } })
      },
      error: () => {
        resolve({
          success: false,
          error: {
            code: 'unreadable',
            message: 'Ce fichier CSV n’a pas pu être lu. Vérifiez son encodage.',
          },
        })
      },
    })
  })
}

/**
 * Lit un fichier Excel (.xlsx, .xlsm).
 *
 * ExcelJS est chargé en import dynamique : c'est une bibliothèque volumineuse,
 * inutile au chargement initial de l'application pour la grande majorité des
 * visites qui ne feront jamais d'import Excel.
 *
 * Le format .xls (Excel 97-2003 binaire) n'est pas pris en charge : la seule
 * bibliothèque npm capable de le lire porte une faille de sécurité non
 * corrigée, jugée inacceptable pour analyser des relevés bancaires (voir
 * README). L'utilisateur est invité à réenregistrer son fichier en .xlsx.
 */
export async function readXlsxFile(file: File): Promise<FileReadResult> {
  if (file.size === 0) {
    return { success: false, error: { code: 'empty', message: 'Ce fichier est vide.' } }
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: { code: 'too_large', message: 'Ce fichier dépasse 20 Mo. Réduisez la période exportée.' },
    }
  }

  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return {
        success: false,
        error: { code: 'empty', message: 'Ce classeur ne contient aucune feuille.' },
      }
    }

    const rows: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      // getCell(i) plutôt que row.values : ce dernier laisse un trou en
      // position 0 et décale toutes les colonnes d'un cran.
      for (let i = 1; i <= worksheet.columnCount; i++) {
        cells.push(formatCellValue(row.getCell(i).value))
      }
      rows.push(cells)
    })

    if (rows.length === 0) {
      return {
        success: false,
        error: { code: 'empty', message: 'Aucune ligne exploitable dans ce classeur.' },
      }
    }

    return { success: true, sheet: { rows, columnCount: longestRowLength(rows) } }
  } catch {
    return {
      success: false,
      error: {
        code: 'unreadable',
        message:
          'Ce fichier Excel n’a pas pu être lu. S’il s’agit d’un ancien format .xls, ' +
          'réenregistrez-le en .xlsx depuis Excel ou LibreOffice.',
      },
    }
  }
}

/** Convertit la valeur d'une cellule ExcelJS en texte exploitable. */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  // Cellule formule : ExcelJS expose { formula, result }. On ne garde que le résultat.
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return formatCellValue((value as { result: unknown }).result)
  }

  // Nombre riche { richText: [...] } pour les cellules à mise en forme mixte.
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText: { text: string }[] }).richText
    return parts.map((part) => part.text).join('')
  }

  return String(value)
}

export type SupportedFileType = 'csv' | 'xlsx' | 'xlsm'

/** Devine le type d'un fichier à partir de son nom, indépendamment du type MIME. */
export function detectFileType(fileName: string): SupportedFileType | null {
  const extension = fileName.toLowerCase().split('.').pop()
  if (extension === 'csv') return 'csv'
  if (extension === 'xlsx') return 'xlsx'
  if (extension === 'xlsm') return 'xlsm'
  return null
}

/** Lit un fichier bancaire, quel que soit son format parmi ceux pris en charge. */
export async function readBankFile(file: File): Promise<FileReadResult> {
  const type = detectFileType(file.name)

  if (type === 'csv') return readCsvFile(file)
  if (type === 'xlsx' || type === 'xlsm') return readXlsxFile(file)

  return {
    success: false,
    error: {
      code: 'unsupported_type',
      message:
        'Format non pris en charge. Utilisez un fichier .csv ou .xlsx. ' +
        'Un ancien fichier .xls doit être réenregistré en .xlsx.',
    },
  }
}
