import { mkdir } from 'node:fs/promises'

await mkdir('./dist', { recursive: true })

console.log('Building Linux x64...')
await Bun.build({
  entrypoints: ['./src/index.tsx'],
  compile: { outfile: 'dist/pairwise-tui' },
})
console.log('✓ dist/pairwise-tui')

console.log('Building Windows x64...')
await Bun.build({
  entrypoints: ['./src/index.tsx'],
  compile: { target: 'bun-windows-x64', outfile: 'dist/pairwise-tui.exe' },
})
console.log('✓ dist/pairwise-tui.exe')

console.log('\nBuild complete!')
