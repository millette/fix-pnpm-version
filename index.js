#!/usr/bin/env node

// node
import { promisify } from 'node:util'
import childProcess from 'node:child_process'

// npm
import { loadJsonFile } from 'load-json-file'
import { writeJsonFile } from 'write-json-file'
import { packageDirectory } from 'pkg-dir'

const exec = promisify(childProcess.exec)
const re = /(.+)(\d+\.\d+\.\d+)/
const pnpmPackageManager = 'pnpm@'


async function getNodeVersion() {
  const { stdout } = await exec("node --version")
  if (!stdout) throw new Error("No global node.")
  return stdout.slice(1, -1)
}

async function updatePackage() {
  const { stdout } = await exec("pnpm --version")
  if (!stdout) throw new Error("No global pnpm.")
  const currentVersion = stdout.trim()
  const p = await packageDirectory()
  if (!p) throw new Error("No package.json found.")
  const fn = `${p}/package.json`
  const json = await loadJsonFile(fn)

  // FIXME: not all errors should be fatal
  if (!json.engines?.pnpm) throw new Error("Not pnpm.")
  if (!json.packageManager) throw new Error("No packageManager.")
  const [, comp, version0] = json.engines.pnpm.match(re)
  const [, isPnpm, version] = json.packageManager.match(re)
  if (isPnpm !== pnpmPackageManager) throw new Error("Not pnpm.")
  if (version0 !== version) throw new Error("pnpm version mismatch.")
  if (currentVersion === version) {
    console.error("Already using current pnpm version, nothing to do.")
    return fn
  }

  const nodeVersion = await getNodeVersion()
  json.engines.node = `${comp}${nodeVersion}`
  json.engines.pnpm = `${comp}${currentVersion}`
  json.packageManager = `${pnpmPackageManager}${currentVersion}`
  if (json.preinstall === "npx -y only-allow pnpm") delete json.preinstall
  await writeJsonFile(fn, json, { detectIndent: true })
  return fn
}

try {
  const fn = await updatePackage()
  console.log("Updated", fn)
} catch (e) {
  console.error(e)
}

