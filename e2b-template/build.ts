import 'dotenv/config'
import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template.js'

async function main() {
  console.log('Building E2B template: tenex-sourcing')
  console.log('This may take a few minutes...\n')

  await Template.build(template, {
    alias: 'tenex-sourcing',
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  })

  console.log('\nTemplate built successfully!')
  console.log('Usage: Sandbox.create("tenex-sourcing")')
}

main().catch(console.error)
