/**
 * 自动更新 android/app/build.gradle 和 package.json 版本号
 *
 * 用法: node scripts/bump-android-version.js
 *
 * 效果:
 *   versionName "1.0"    → "1.1"
 *   versionName "1.0.0"  → "1.0.1"  (3段格式也支持)
 *   versionCode N        → N+1
 *   package.json version → 同步更新
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gradlePath = path.resolve(__dirname, '../android/app/build.gradle')
const pkgPath = path.resolve(__dirname, '../package.json')

// 1. 读取 build.gradle
let content = fs.readFileSync(gradlePath, 'utf-8')

// 2. 匹配 versionName — 支持 "x.y" 或 "x.y.z" 格式
const versionNameMatch = content.match(/versionName\s+"(\d+)\.(\d+)(?:\.(\d+))?"/)
if (!versionNameMatch) {
  console.error('[BOWEN_LOG] 未找到 versionName (格式: "x.y" 或 "x.y.z")')
  process.exit(1)
}

const major = parseInt(versionNameMatch[1], 10)
const minor = parseInt(versionNameMatch[2], 10)
const patch = versionNameMatch[3] !== undefined ? parseInt(versionNameMatch[3], 10) : -1

let newVersionName
if (patch >= 0) {
  // "x.y.z" → bump patch
  newVersionName = `${major}.${minor}.${patch + 1}`
} else {
  // "x.y" → bump minor
  newVersionName = `${major}.${minor + 1}`
}

// 3. 匹配 versionCode
const versionCodeMatch = content.match(/versionCode\s+(\d+)/)
if (!versionCodeMatch) {
  console.error('[BOWEN_LOG] 未找到 versionCode')
  process.exit(1)
}

const oldVersionCode = parseInt(versionCodeMatch[1], 10)
const newVersionCode = oldVersionCode + 1

// 4. 替换 build.gradle
content = content.replace(
  /versionCode\s+\d+/,
  `versionCode ${newVersionCode}`
)
content = content.replace(
  /versionName\s+"[\d.]+"/,
  `versionName "${newVersionName}"`
)

fs.writeFileSync(gradlePath, content, 'utf-8')

// 5. 同步更新 package.json 的 version 字段
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
pkg.version = newVersionName
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')

console.log(`[BOWEN_LOG] versionName 已更新: ${versionNameMatch[0].trim()} → ${newVersionName}`)
console.log(`[BOWEN_LOG] versionCode 已更新: ${oldVersionCode} → ${newVersionCode}`)
console.log(`[BOWEN_LOG] package.json version 已同步: ${newVersionName}`)