# API
## 搜单词

基本说明：

| 接口地址：[http://dict.youdao.com/suggest](javascript:copytext('hrefcopy',0);) |
| :----------------------------------------------------------- |
| 返回格式：json                                               |
| 请求方式：get/post                                           |
| 请求示例：http://dict.youdao.com/suggest?q=love&num=1&doctype=json |

请求参数说明：

| 名称    | 类型   | 必填 | 说明              |
| :------ | :----- | :--- | :---------------- |
| q       | string | 必填 | 关键字            |
| num     | int    | 选填 | 单词个数，默认5各 |
| doctype | string | 选填 | 返回格式，默认xml |

返回参数说明：

| 名称    | 类型   | 说明     |
| :------ | :----- | :------- |
| explain | string | 单词解释 |
| entry   | string | 单词     |

JSON返回示例：

复制

```
{
    "result": {
        "msg": "success",
        "code": 200
    },
    "data": {
        "entries": [
            {
                "explain": "n. 爱；爱情；喜好；（昵称）亲爱的；爱你的；心爱的人；钟爱之物；零分; v. 爱恋（某人）；关爱；...",
                "entry": "love"
            }
        ],
        "query": "love",
        "language": "en",
        "type": "dict"
    }
}
```