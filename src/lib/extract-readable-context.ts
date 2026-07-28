/**
 * 从全文提取可读的上下文：优先完整句，其次按词边界取窗口，最后截断。
 *
 * @param fullText  所在 DOM 节点的完整文本
 * @param wordStart 选中词在 fullText 中的起始位置
 * @param wordEnd   选中词在 fullText 中的结束位置
 * @param maxLen    最大允许长度
 */
export function extractReadableContext(
  fullText: string,
  wordStart: number,
  wordEnd: number,
  maxLen: number,
): string {
  const trimmed = fullText.trim();
  const word = trimmed.slice(wordStart, wordEnd);
  console.log(
    `[BOWEN_LOG] extractReadableContext input: len=${trimmed.length}, word="${word}"@(${wordStart}-${wordEnd}), text=${trimmed.slice(0, 120)}${trimmed.length > 120 ? "…" : ""}`,
  );
  if (trimmed.length <= maxLen) {
    console.log(`[BOWEN_LOG] extractReadableContext result: path=全文, len=${trimmed.length}`);
    return trimmed;
  }

  // 找到选中词所在句子的边界
  const sentenceBoundary = /[.?!](?:\s+|$)/g;
  let sentenceStart = 0;
  let sentenceEnd = trimmed.length;
  let match: RegExpExecArray | null;

  // 向前找句首
  let searchPos = 0;
  while ((match = sentenceBoundary.exec(trimmed)) !== null) {
    if (match.index + match[0].length <= wordStart) {
      sentenceStart = match.index + match[0].length;
      searchPos = sentenceBoundary.lastIndex;
    } else if (match.index >= wordStart) {
      sentenceEnd = match.index + match[0].length;
      break;
    }
  }

  // 重置并向后找句尾（如果上面循环没找到）
  if (sentenceEnd === trimmed.length && sentenceStart < wordStart) {
    sentenceBoundary.lastIndex = searchPos;
    while ((match = sentenceBoundary.exec(trimmed)) !== null) {
      if (match.index >= wordStart) {
        sentenceEnd = match.index + match[0].length;
        break;
      }
    }
  }

  const sentence = trimmed.slice(sentenceStart, sentenceEnd).trim();
  if (sentence.length > maxLen) {
    // 句子仍然太长，按词边界取窗口
    const halfLen = Math.floor(maxLen / 2);
    const wordPosInSentence = wordStart - sentenceStart;
    let windowStart = sentenceStart + Math.max(0, wordPosInSentence - halfLen);
    let windowEnd =
      sentenceStart +
      Math.min(sentence.length, wordPosInSentence + (wordEnd - wordStart) + halfLen);

    // 对齐到词边界
    if (windowStart > sentenceStart) {
      const nextSpace = trimmed.indexOf(" ", windowStart);
      if (nextSpace !== -1 && nextSpace < windowEnd) windowStart = nextSpace + 1;
    }
    if (windowEnd < sentenceEnd) {
      const prevSpace = trimmed.lastIndexOf(" ", windowEnd);
      if (prevSpace > windowStart) windowEnd = prevSpace;
    }

    let result = trimmed.slice(windowStart, windowEnd).trim();
    if (result.length > maxLen) {
      result = result.slice(0, Math.max(result.lastIndexOf(" ", maxLen), 0)).trim();
    }
    const finalResult = result || trimmed.slice(0, maxLen).trim();
    console.log(`[BOWEN_LOG] extractReadableContext result: path=窗口截断, len=${finalResult.length}`);
    return finalResult;
  }

  // 完整句 ≤ maxLen：尽量将相邻句子也包进来（前优先），充分利用剩余空间
  let expandedStart = sentenceStart;
  let expandedEnd = sentenceEnd;

  // 向前扩展：收集当前句之前的所有句尾，从近到远逐个尝试纳入
  if (expandedStart > 0) {
    sentenceBoundary.lastIndex = 0;
    const prevBoundaries: number[] = [];
    while ((match = sentenceBoundary.exec(trimmed)) !== null) {
      const boundaryEnd = match.index + match[0].length;
      if (boundaryEnd < expandedStart) {
        prevBoundaries.push(boundaryEnd);
      } else {
        break;
      }
    }
    for (let i = prevBoundaries.length - 1; i >= 0; i--) {
      const candidate = trimmed.slice(prevBoundaries[i], expandedEnd).trim();
      if (candidate.length <= maxLen) {
        expandedStart = prevBoundaries[i];
      } else {
        break;
      }
    }
  }

  // 向后扩展：从当前句尾往后扫描，逐个纳入后续句子
  if (expandedEnd < trimmed.length) {
    sentenceBoundary.lastIndex = expandedEnd;
    while ((match = sentenceBoundary.exec(trimmed)) !== null) {
      const boundaryEnd = match.index + match[0].length;
      const candidate = trimmed.slice(expandedStart, boundaryEnd).trim();
      if (candidate.length <= maxLen) {
        expandedEnd = boundaryEnd;
      } else {
        break;
      }
    }
  }

  if (expandedStart !== sentenceStart || expandedEnd !== sentenceEnd) {
    const result = trimmed.slice(expandedStart, expandedEnd).trim();
    console.log(`[BOWEN_LOG] extractReadableContext result: path=扩展句, len=${result.length}`);
    return result;
  }

  console.log(`[BOWEN_LOG] extractReadableContext result: path=完整句, len=${sentence.length}`);
  return sentence;
}