/**
 * extractReadableContext 效果演示脚本（纯 Node.js 版，无需 tsx）
 *
 * 运行: node src/lib/__tests__/extract-readable-context.demo.cjs
 */
const { extractReadableContext } = require("../extract-readable-context");

const MAX = 500;

function show(label, fullText, wordStart, wordEnd) {
  const word = fullText.slice(wordStart, wordEnd);
  const result = extractReadableContext(fullText, wordStart, wordEnd, MAX);
  console.log("=".repeat(70));
  console.log(`[${label}]`);
  console.log(`  选中词:   "${word}" (pos ${wordStart}-${wordEnd})`);
  console.log(`  原文长度:  ${fullText.length} 字`);
  console.log(`  结果长度:  ${result.length} 字  (max=${MAX})`);
  const ratio = ((result.length / MAX) * 100).toFixed(0);
  console.log(`  使用率:    ${ratio}%`);
  if (result.length > MAX) console.log(`  ⛔ 超过 maxLen! 超出 ${result.length - MAX} 字`);
  if (!result.includes(word)) console.log(`  ⛔ 选中词未包含在结果中!`);
  console.log(`  结果:`);
  console.log(`    ${result}`);
  console.log();
}

// === 场景1: 短文本 ===
show("短文本-全文返回", "The quick brown fox.", 4, 9);

// === 场景2: 多句提取 ===
const multiSentence =
  "Artificial intelligence is transforming the world. " +
  "Machine learning algorithms can analyze vast amounts of data. " +
  "Deep learning takes it even further.";
show("多句-提取中间句", multiSentence, multiSentence.indexOf("vast amounts"), multiSentence.indexOf("vast amounts") + "vast amounts".length);

// === 场景3: 超长句子 ===
const longSentence =
  "The comprehensive analysis of the experimental data revealed that " +
  "the newly developed machine learning algorithm demonstrated significantly " +
  "superior performance compared to traditional statistical methods when " +
  "applied to large-scale biological sequence classification tasks involving " +
  "thousands of different protein families across multiple species. " +
  "This breakthrough has important implications for drug discovery.";
show("超长句-截断到500", longSentence, longSentence.indexOf("machine learning"), longSentence.indexOf("machine learning") + "machine learning".length);

// === 场景4: 真实段落 ===
const realPara =
  "Climate change is one of the most pressing challenges facing humanity today. " +
  "Scientists have warned that global temperatures could rise by more than " +
  "two degrees Celsius by the end of the century if immediate action is not taken. " +
  "This would lead to catastrophic consequences including extreme weather events, " +
  "rising sea levels, and widespread biodiversity loss. " +
  "Governments around the world are now working to implement policies that " +
  "reduce carbon emissions and promote sustainable development.";
show("真实段落-选中段中词", realPara, realPara.indexOf("catastrophic consequences"), realPara.indexOf("catastrophic consequences") + "catastrophic consequences".length);
show("真实段落-末句", realPara, realPara.indexOf("carbon emissions"), realPara.indexOf("carbon emissions") + "carbon emissions".length);

// === 场景5: 各种标点 ===
show("疑问句", "What is machine learning? It is a powerful tool.", "What is machine learning?".indexOf("machine learning"), "What is machine learning?".indexOf("machine learning") + "machine learning".length);
show("感叹句", "Wow! Machine learning is amazing. It really works.", "Wow! Machine learning is amazing. It really works.".indexOf("Machine learning"), "Wow! Machine learning is amazing. It really works.".indexOf("Machine learning") + "Machine learning".length);

// === 场景6: 边界位置 ===
show("词在文本开头", "Hello world. How are you?", 0, 5);
const youIdx = "Hello world. How are you?".indexOf("you");
show("词在文本末尾", "Hello world. How are you?", youIdx, youIdx + 3);