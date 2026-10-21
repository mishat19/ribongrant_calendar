import { spawn } from "node:child_process"
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = process.argv[2] || "nsis"
const finalOutputDir = path.join(rootDir, "dist_electron")
const stagingDir = path.join(tmpdir(), "ribongrant-electron-build")

const ignoredEntries = new Set([
  "win-unpacked",
  "win-unpacked.tmp",
  "builder-debug.yml",
  "builder-effective-config.yaml",
])

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} a échoué (code ${code})`))
    )
  })
}

await rm(stagingDir, { recursive: true, force: true })
await mkdir(stagingDir, { recursive: true })

const builderCli = path.join(rootDir, "node_modules", "electron-builder", "cli.js")

await run(process.execPath, [builderCli, "--win", target, `-c.directories.output=${stagingDir}`])

await mkdir(finalOutputDir, { recursive: true })
const copied = []
for (const entry of await readdir(stagingDir, { withFileTypes: true })) {
  if (ignoredEntries.has(entry.name)) continue
  await cp(path.join(stagingDir, entry.name), path.join(finalOutputDir, entry.name), {
    recursive: true,
    force: true,
  })
  copied.push(entry.name)
}

console.log(`\nArtefacts copiés dans ${finalOutputDir} :`)
for (const name of copied) console.log(`  ${name}`)
