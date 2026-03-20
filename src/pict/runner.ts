import { chmodSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { PictModel, PictOptions, TestCase } from '../types'
import { buildModelFile } from './model'

// Embedded at compile time — Bun extracts to a temp path at runtime
// @ts-ignore - Bun file asset embedding
import pictLinuxPath from '../../binaries/pict' with { type: 'file' }
// @ts-ignore - Bun file asset embedding
import pictWinPath from '../../binaries/pict.exe' with { type: 'file' }

export function getPictBinaryPath(): string {
  const binaryPath = process.platform === 'win32' ? pictWinPath : pictLinuxPath
  if (process.platform !== 'win32') {
    try { chmodSync(binaryPath, 0o755) } catch { /* ignore */ }
  }
  return binaryPath
}

export async function runPict(model: PictModel, options: PictOptions): Promise<TestCase[]> {
  const binaryPath = getPictBinaryPath()
  const modelContent = buildModelFile(model)
  const tmpPath = `${tmpdir()}/pict-${Date.now()}.txt`

  await Bun.write(tmpPath, modelContent)

  const args: string[] = [binaryPath, tmpPath]
  if (options.order !== 2) args.push(`/o:${options.order}`)
  if (options.randomize) args.push('/r')
  if (options.caseSensitive) args.push('/c')

  const result = Bun.spawnSync(args)

  try { unlinkSync(tmpPath) } catch { /* ignore */ }

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || 'PICT execution failed')
  }

  return parseTsvOutput(result.stdout.toString())
}

function parseTsvOutput(output: string): TestCase[] {
  const lines = output.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0]!.split('\t').map(h => h.trim())
  const rows: TestCase[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue
    const values = line.split('\t')
    const row: TestCase = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  return rows
}
