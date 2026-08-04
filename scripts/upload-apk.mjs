import { readFileSync, existsSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'
import { put } from '@vercel/blob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 从 build.gradle 读取版本号
const buildGradle = readFileSync(resolve(root, 'android/app/build.gradle'), 'utf-8')
const versionMatch = buildGradle.match(/versionName\s+"([^"]+)"/)
const version = versionMatch ? versionMatch[1] : '1.0'

const buildType = process.argv.includes('--debug') ? 'debug' : 'release'
const apkName = `EnglishRead-v${version}-${buildType}.apk`
const apkPath = resolve(root, `android/app/build/outputs/apk/${buildType}/${apkName}`)
const blobPath = `apks/${apkName}`

if (!existsSync(apkPath)) {
  console.error(`[BOWEN_LOG] APK 文件未找到: ${apkPath}`)
  process.exit(1)
}

const { size } = statSync(apkPath)
console.log(`[BOWEN_LOG] APK 包已就绪:`)
console.log(`  文件: ${apkPath}`)
console.log(`  大小: ${(size / 1024 / 1024).toFixed(1)} MB`)
console.log('')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const answer = await new Promise((resolve) => {
  rl.question('是否上传到 Vercel Blob？(y/N) ', (input) => {
    resolve(input.trim().toLowerCase())
  })
})
rl.close()

if (answer !== 'y' && answer !== 'yes') {
  console.log('[BOWEN_LOG] 已跳过上传。')
  process.exit(0)
}

const fileBuffer = readFileSync(apkPath)
console.log(`[BOWEN_LOG] 正在上传 ${apkName} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB)...`)

try {
  const { url } = await put(blobPath, fileBuffer, {
    access: 'public',
    contentType: 'application/vnd.android.package-archive',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  console.log(`[BOWEN_LOG] 上传成功: ${url}`)
} catch (e) {
  console.error('[BOWEN_LOG] 上传失败:', e.message)
  process.exit(1)
}