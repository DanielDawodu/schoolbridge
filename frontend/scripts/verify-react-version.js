import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

function verifyReactVersions() {
  console.log('[React Version Check] Validating react and react-dom dependency alignment...')

  const frontendDir = path.resolve(__dirname, '..')
  const rootDir = path.resolve(frontendDir, '..')
  const searchPaths = [frontendDir, rootDir]

  let reactPkgPath
  let reactDomPkgPath

  try {
    reactPkgPath = require.resolve('react/package.json', { paths: searchPaths })
  } catch (err) {
    console.error('[React Version Check Error] Could not resolve react/package.json:', err.message)
    process.exit(1)
  }

  try {
    reactDomPkgPath = require.resolve('react-dom/package.json', { paths: searchPaths })
  } catch (err) {
    console.error('[React Version Check Error] Could not resolve react-dom/package.json:', err.message)
    process.exit(1)
  }

  // Also verify sub-entry resolution works without hardcoded path issues
  try {
    require.resolve('react/jsx-runtime', { paths: searchPaths })
    require.resolve('react-dom/client', { paths: searchPaths })
  } catch (err) {
    console.error('[React Version Check Error] Could not resolve React subpaths:', err.message)
    process.exit(1)
  }

  const reactPkg = JSON.parse(fs.readFileSync(reactPkgPath, 'utf8'))
  const reactDomPkg = JSON.parse(fs.readFileSync(reactDomPkgPath, 'utf8'))

  const reactVersion = reactPkg.version
  const reactDomVersion = reactDomPkg.version

  console.log(`  -> Resolved react:      ${reactVersion} (${reactPkgPath})`)
  console.log(`  -> Resolved react-dom:  ${reactDomVersion} (${reactDomPkgPath})`)

  if (reactVersion !== reactDomVersion) {
    console.error('\n' + '='.repeat(80))
    console.error('FATAL BUILD ERROR: INCOMPATIBLE REACT VERSION MISMATCH DETECTED')
    console.error('='.repeat(80))
    console.error(`  react:     ${reactVersion}`)
    console.error(`  react-dom: ${reactDomVersion}`)
    console.error('\nReact and React DOM must have identical versions to prevent runtime')
    console.error('Minified React error #527 ("The current dispatcher is not compatible...").')
    console.error('Build aborted to prevent deploying a broken blank screen to production.')
    console.error('='.repeat(80) + '\n')
    process.exit(1)
  }

  console.log(`[React Version Check] SUCCESS: react and react-dom versions match exactly (${reactVersion}).\n`)
}

verifyReactVersions()
