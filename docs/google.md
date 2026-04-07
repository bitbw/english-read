# **方法：翻译**

翻译输入的文本，返回翻译后的文本。

### HTTP 请求

`POST https://translation.googleapis.com/language/translate/v2`

该URL使用了[Google API HTTP注解](https://github.com/googleapis/googleapis/blob/master/google/api/http.proto)语法。

### 查询参数


| **参数**   |                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`      | `string`*必填项：*待翻译的文本输入。请提供一个字符串数组以翻译多个短语。字符串数量最多为 128 个。                                                                                                                          |
| `target` | `string`*必填项*用于翻译输入文本的语言，设置为[语言支持](https://docs.cloud.google.com/translate/docs/languages)中列出的语言代码之一。                                                                             |
| `format` | `string`源文本格式，可以是 HTML（默认）或纯文本。值为 `htmlHTML` 表示 HTML，值为`text` `纯文本` 表示纯文本。                                                                                                        |
| `source` | `string`源文本的语言，设置为 [“语言支持”](https://docs.cloud.google.com/translate/docs/languages)中列出的语言代码之一。如果未指定源语言，API 将尝试自动检测源语言并将其包含在响应中。                                                   |
| `model`  | `string`翻译模型。支持的值包括`nmt`（默认值）和标准翻译 LLM 模型的完整资源名称（例如`projects/{project-id}/locations/{location-id}/models/general/translation-llm`）。云翻译 - 基本版不支持自定义模型。如果模型是`base`，则使用 NMT 模型翻译请求。 |
| `key`    | `string`用于处理此 API 请求的有效 API 密钥。如果您使用的是 OAuth 2.0 服务帐户凭据（推荐），则无需提供此参数。                                                                                                             |


### 应答机构

如果成功，响应正文包含以下结构的数据：


| **JSON 表示**                                                |     |
| ---------------------------------------------------------- | --- |
| ``` { "data": { object(TranslateTextResponseList) }, } ``` |     |



| **田野** |                                                                               |
| ------ | ----------------------------------------------------------------------------- |
| `data` | `object(TranslateTextResponseList)`语言翻译响应列表。此列表包含语言翻译请求中发送的每个查询 (q) 的语言翻译响应。 |


### 授权

需要以下 OAuth 范围之一：

- `https://www.googleapis.com/auth/cloud-translation`
- `https://www.googleapis.com/auth/cloud-platform`

更多信息请参阅[身份验证指南](https://cloud.google.com/docs/authentication/)。

## 翻译文本响应列表

回复列表包含一系列单独的语言翻译回复。


| **JSON 表示**                            |     |
| -------------------------------------- | --- |
| ``` { "translations": [ array ], } ``` |     |



| **田野**           |                                                              |
| ---------------- | ------------------------------------------------------------ |
| `translations[]` | `array (TranslateTextResponseTranslation)`包含所提供文本的翻译结果列表。 |


## 翻译文本回复​

包含所请求文本的翻译结果列表。


| **JSON 表示**                                                                              |     |
| ---------------------------------------------------------------------------------------- | --- |
| ``` { "detectedSourceLanguage": string, "model": string, "translatedText": string, } ``` |     |



| **田野**                   |                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `detectedSourceLanguage` | `string`如果初始请求中未指定源语言，则系统会自动检测初始请求的源语言。​​如果已指定源语言，则不会进行自动检测，此字段将被省略。                                 |
| `model`                  | `string`用于此请求的翻译模型。支持的值包括`nmt`标准翻译 LLM 模型的完整资源名称。“云翻译 - 基本版”不支持自定义模型。如果您在请求中未包含`model`参数，则响应中不会包含此字段。 |
| `translatedText`         | `string`文本已翻译成目标语言。                                                                                   |


