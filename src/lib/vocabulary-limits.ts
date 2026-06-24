/** 生词本各字段最大长度（前后端共用，防止异常大文本占用数据库） */

/** 单词或短语（手动输入；阅读划词通常更短） */
export const VOCAB_WORD_MAX_LENGTH = 100;

/** 引用 / 原文上下文 / 笔记 */
export const VOCAB_CONTEXT_MAX_LENGTH = 500;

/** 序列化后的词典释义 JSON */
export const VOCAB_DEFINITION_MAX_LENGTH = 8000;

/** 音标 */
export const VOCAB_PHONETIC_MAX_LENGTH = 128;

/** 发音 mp3 URL */
export const VOCAB_AUDIO_URL_MAX_LENGTH = 2048;

/** 用户备注（编辑生词） */
export const VOCAB_NOTE_MAX_LENGTH = 2000;
