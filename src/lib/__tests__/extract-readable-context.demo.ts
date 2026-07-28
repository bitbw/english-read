/**
 * extractReadableContext 效果演示脚本
 *
 * 运行: npx tsx src/lib/__tests__/extract-readable-context.demo.ts
 */
import { extractReadableContext } from "../extract-readable-context";

const MAX = 500;

function show(label: string, fullText: string, wordStart: number, wordEnd: number) {
  const word = fullText.slice(wordStart, wordEnd);
  const result = extractReadableContext(fullText, wordStart, wordEnd, MAX);
  console.log("=".repeat(70));
  console.log(`[${label}]`);
  console.log(`  选中词:   "${word}" (pos ${wordStart}-${wordEnd})`);
  console.log(`  原文长度:  ${fullText.length} 字`);
  console.log(`  结果长度:  ${result.length} 字  (max=${MAX})`);
  const ratio = ((result.length / MAX) * 100).toFixed(0);
  console.log(`  使用率:    ${ratio}%`);
  if (result.length > MAX) console.log(`  ⛔ 超过 maxLen!`);
  if (!result.includes(word)) console.log(`  ⛔ 选中词未包含在结果中!`);
  console.log(`  结果:`);
  console.log(`    ${result}`);
  console.log();
}

// ============================================================
// 场景1: 短文本 — 全文 ≤ 500，验证直接返回
// ============================================================
show("短文本-全文返回", "The quick brown fox jumps over the lazy dog.", 4, 9);

// ============================================================
// 场景2: 多句段落(>500字) — 验证提取完整句
// ============================================================
const longPara =
  "Artificial intelligence has made remarkable progress in recent years. " +
  "Machine learning algorithms can now analyze vast amounts of data with unprecedented accuracy. " +
  "This has led to breakthroughs in fields ranging from medical diagnosis to autonomous driving. " +
  "However, researchers caution that these systems still lack common sense reasoning abilities. " +
  "The development of general artificial intelligence remains a distant goal. " +
  "Many experts believe that we are still decades away from achieving human-level intelligence. " +
  "Despite these limitations, AI continues to transform industries across the globe. " +
  "Companies are investing billions of dollars in AI research and development. " +
  "The economic impact of AI is expected to reach trillions of dollars in the coming decade. " +
  "Governments are also racing to establish regulations for responsible AI development. " +
  "The future of AI holds both tremendous promise and significant challenges. " +
  "It is up to us to ensure that AI benefits all of humanity.";
console.log(`  ↳ longPara 实际长度: ${longPara.length} 字`);

show("多句-提取首句", longPara, longPara.indexOf("Artificial intelligence"), longPara.indexOf("Artificial intelligence") + "Artificial intelligence".length);
show("多句-提取中间句", longPara, longPara.indexOf("common sense"), longPara.indexOf("common sense") + "common sense".length);
show("多句-提取末句", longPara, longPara.indexOf("AI benefits"), longPara.indexOf("AI benefits") + "AI benefits".length);

// ============================================================
// 场景3: 超长单句(>500字) — 验证按词边界窗口截断
// ============================================================
const longSentence =
  "Neural radiance fields commonly known as NeRF have emerged as a groundbreaking paradigm " +
  "for novel view synthesis achieving photorealistic renderings of complex three-dimensional scenes " +
  "from sparse input images by learning a continuous volumetric representation that maps spatial " +
  "coordinates and viewing directions to color and density values using a deep multilayer perceptron " +
  "which enables the generation of highly detailed and view consistent novel views that were " +
  "previously only possible with extensive manual modeling or large numbers of input photographs " +
  "making it a revolutionary approach in the field of computer vision and graphics with broad " +
  "applications in virtual reality augmented reality digital heritage preservation and cinematic " +
  "visual effects production pipelines all while requiring minimal human intervention and " +
  "dramatically reducing the time and cost associated with traditional 3D content creation workflows.";
console.log(`  ↳ longSentence 实际长度: ${longSentence.length} 字`);

show("超长单句-选中前部词", longSentence, longSentence.indexOf("NeRF"), longSentence.indexOf("NeRF") + "NeRF".length);
show("超长单句-选中中部词", longSentence, longSentence.indexOf("multilayer perceptron"), longSentence.indexOf("multilayer perceptron") + "multilayer perceptron".length);
show("超长单句-选中后部词", longSentence, longSentence.indexOf("3D content creation"), longSentence.indexOf("3D content creation") + "3D content creation".length);

// ============================================================
// 场景4: 对比 — 同一段文字，有句号 vs 无句号
// 说明：在句子中间加个句号断句后，函数就能返回完整句而非窗口截断
// ============================================================
const noBoundary =
  "Neural radiance fields also known as NeRF have emerged as a groundbreaking paradigm " +
  "for novel view synthesis using deep learning and continuous volumetric scene representations " +
  "that can produce highly realistic novel views of complex scenes from a sparse set of input images " +
  "making it a revolutionary approach with broad applications in virtual reality and computer graphics. " +
  "This technique has transformed the field of computer vision and graphics significantly.";
const withBoundary =
  "Neural radiance fields also known as NeRF have emerged as a groundbreaking paradigm " +
  "for novel view synthesis using deep learning and continuous volumetric scene representations. " + // ← 加了句号
  "This technique can produce highly realistic novel views of complex scenes from a sparse set " +
  "of input images making it a revolutionary approach with broad applications in virtual reality. " +
  "The field of computer vision and graphics has been transformed significantly.";
// 确保 noBoundary 整体 > 500，但 withBoundary 的第一句 < 500
console.log(`  ↳ noBoundary 长度: ${noBoundary.length} 字（>500=${noBoundary.length > 500}）`);
console.log(`  ↳ withBoundary 长度: ${withBoundary.length} 字`);
const nefPos1 = noBoundary.indexOf("NeRF");
const nefPos2 = withBoundary.indexOf("NeRF");
show("【无句号】超长单句中选中词", noBoundary, nefPos1, nefPos1 + "NeRF".length);
show("【有句号】多句中断句后选词", withBoundary, nefPos2, nefPos2 + "NeRF".length);

// ============================================================
// 场景5: 超长段落(>500字)中某句也超长 — 验证句优先+句超长回退
// ============================================================
const mixedParagraph =
  "The history of natural language processing spans several decades of innovation. " +
  "Early approaches relied on rule-based systems and hand-crafted linguistic features that required " +
  "extensive domain expertise and labor intensive manual effort to develop and maintain for each " +
  "specific language and task combination making them difficult to scale across different languages " +
  "and application domains which limited their practical utility in real world settings. " +
  "The introduction of statistical methods marked a significant improvement in performance. " +
  "Modern deep learning approaches have revolutionized the field achieving human-level performance. " +
  "These models can understand context, generate coherent text, and even translate between languages. " +
  "The latest large language models represent a quantum leap in what is technically possible. " +
  "They can write essays, answer questions, and engage in nuanced conversations. " +
  "However, challenges remain regarding bias, factuality, and computational cost.";
console.log(`  ↳ mixedParagraph 实际长度: ${mixedParagraph.length} 字`);

show("混合-选中短句中的词(句中)", mixedParagraph, mixedParagraph.indexOf("natural language processing"), mixedParagraph.indexOf("natural language processing") + "natural language processing".length);
show("混合-选中超长句中的词(句超长回退窗口)", mixedParagraph, mixedParagraph.indexOf("labor intensive"), mixedParagraph.indexOf("labor intensive") + "labor intensive".length);

// ============================================================
// 场景5: 各种标点分割 — 验证 .?!
// ============================================================
show("疑问句分割", "What exactly is machine learning? It is a subfield of artificial intelligence. This question is commonly asked.", "What exactly is machine learning? It is a subfield of artificial intelligence. This question is commonly asked.".indexOf("machine learning"), "What exactly is machine learning? It is a subfield of artificial intelligence. This question is commonly asked.".indexOf("machine learning") + "machine learning".length);
show("感叹句分割", "Neural networks are incredible! They can recognize patterns in complex data. This capability is very useful.", "Neural networks are incredible! They can recognize patterns in complex data. This capability is very useful.".indexOf("incredible"), "Neural networks are incredible! They can recognize patterns in complex data. This capability is very useful.".indexOf("incredible") + "incredible".length);

// ============================================================
// 场景6: 边界位置
// ============================================================
show("词在文本开头(0-5)", "Hello world. This is a test sentence. The quick brown fox.", 0, 5);
const endIdx = "Hello world. This is a test sentence. The quick brown fox.".indexOf("brown fox");
show("词在文本末尾", "Hello world. This is a test sentence. The quick brown fox.", endIdx, endIdx + "brown fox".length);