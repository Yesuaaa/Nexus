// Credential-isolated test/demo process preload, supplied by the owning launcher.
// Block environment-file IO before Next, Prisma or dotenv can load credentials.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { syncBuiltinESMExports } from "node:module"

function protectedPath(value) {
  const candidate = value instanceof URL ? fileURLToPath(value) : value
  return (
    (typeof candidate === "string" || Buffer.isBuffer(candidate)) &&
    /^\.env(?:\.|$)/i.test(path.basename(String(candidate))) &&
    path.basename(String(candidate)) !== ".env.example"
  )
}
function unavailable() {
  const error = new Error(
    "Environment files are unavailable in isolated local workflows",
  )
  error.code = "ENOENT"
  return error
}
for (const method of ["readFileSync", "openSync", "statSync", "lstatSync"]) {
  const original = fs[method]
  fs[method] = function (file, ...args) {
    if (protectedPath(file)) throw unavailable()
    return Reflect.apply(original, this, [file, ...args])
  }
}
for (const method of ["readFile", "open", "stat", "lstat"]) {
  const original = fs[method]
  fs[method] = function (file, ...args) {
    if (protectedPath(file)) {
      const callback = args.at(-1)
      if (typeof callback === "function") {
        queueMicrotask(() => callback(unavailable()))
        return
      }
      throw unavailable()
    }
    return Reflect.apply(original, this, [file, ...args])
  }
  const promiseOriginal = fs.promises[method]
  fs.promises[method] = async function (file, ...args) {
    if (protectedPath(file)) throw unavailable()
    return Reflect.apply(promiseOriginal, this, [file, ...args])
  }
}
for (const method of ["copyFileSync", "copyFile"]) {
  const original = fs[method]
  fs[method] = function (source, destination, ...args) {
    if (protectedPath(source) || protectedPath(destination)) {
      const callback = args.at(-1)
      if (method === "copyFile" && typeof callback === "function") {
        queueMicrotask(() => callback(unavailable()))
        return
      }
      throw unavailable()
    }
    return Reflect.apply(original, this, [source, destination, ...args])
  }
}
const copyFile = fs.promises.copyFile
fs.promises.copyFile = async function (source, destination, ...args) {
  if (protectedPath(source) || protectedPath(destination)) throw unavailable()
  return Reflect.apply(copyFile, this, [source, destination, ...args])
}
process.loadEnvFile = () => {
  throw unavailable()
}
syncBuiltinESMExports()
