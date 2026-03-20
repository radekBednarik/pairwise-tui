export interface Parameter {
  name: string
  values: string[]
}

export interface PictModel {
  parameters: Parameter[]
  constraints: string
}

export interface PictOptions {
  order: number
  randomize: boolean
  caseSensitive: boolean
}

export interface OutputConfig {
  filePath: string
  format: OutputFormat
}

export type OutputFormat = 'txt'

export type TestCase = Record<string, string>
