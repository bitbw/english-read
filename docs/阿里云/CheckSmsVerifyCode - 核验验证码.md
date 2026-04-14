核验短信验证码并返回核验是否成功的结果。

## 调试

[您可以在OpenAPI Explorer中直接运行该接口，免去您计算签名的困扰。运行成功后，OpenAPI Explorer可以自动生成SDK代码示例。](https://api.aliyun.com/api/Dypnsapi/2017-05-25/CheckSmsVerifyCode)

 [![](https://img.alicdn.com/tfs/TB16JcyXHr1gK0jSZR0XXbP8XXa-24-26.png) 调试](https://api.aliyun.com/api/Dypnsapi/2017-05-25/CheckSmsVerifyCode)

## **授权信息**

下表是API对应的授权信息，可以在RAM权限策略语句的`Action`元素中使用，用来给RAM用户或RAM角色授予调用此API的权限。具体说明如下：

-   操作：是指具体的权限点。
    
-   访问级别：是指每个操作的访问级别，取值为写入（Write）、读取（Read）或列出（List）。
    
-   资源类型：是指操作中支持授权的资源类型。具体说明如下：
    
    -   对于必选的资源类型，用前面加 \* 表示。
        
    -   对于不支持资源级授权的操作，用`全部资源`表示。
        
-   条件关键字：是指云产品自身定义的条件关键字。
    
-   关联操作：是指成功执行操作所需要的其他权限。操作者必须同时具备关联操作的权限，操作才能成功。
    

| **操作** | **访问级别** | **资源类型** | **条件关键字** | **关联操作** |
| --- | --- | --- | --- | --- |
| dypns:CheckSmsVerifyCode | none | \\*全部资源 `*` | 无   | 无   |

## 请求参数

| **名称** | **类型** | **必填** | **描述** | **示例值** |
| --- | --- | --- | --- | --- |
| SchemeName | string | 否   | 方案名称，如果不填则为“默认方案”。最多不超过 20 个字符。 **重要** 如果发送接口的方案名称不为空，请确保该参数不为空且与发送接口的方案名称参数一致 | 测试方案 |
| CountryCode | string | 否   | 号码国家编码，默认为 86。 | 86  |
| PhoneNumber | string | 是   | 手机号。 | 186\\*\\*\\*\\*0000 |
| OutId | string | 否   | 外部流水号。 | 12123231 |
| VerifyCode | string | 是   | 验证码。 **说明** - SendSmsVerifyCode 接口的字段 TemplateParam，配置方式有 2 种： - - {"code":"##code##","min":"5"} - - {"code":"123456","min":"5"} - {"code":"##code##","min":"5"}验证码是 api 动态生成的，阿里云接口可以完成校验。 - {"code":"123456","min":"5"}验证码是用户配置的不是 api 动态生成，阿里云接口无法校验。 - 请您按照实际情况传入对应的验证码。 | 1231 |
| CaseAuthPolicy | integer | 否   | 验证码大小写字母核验策略。取值： - 1：不区分大小写。 - 2：区分大小写。 | 1   |

## **返回参数**

| **名称** | **类型** | **描述** | **示例值** |
| --- | --- | --- | --- |
|     | object |     |     |
| AccessDeniedDetail | string | 访问被拒绝详细信息。 | 无   |
| Message | string | 状态码的描述。 | 成功  |
| Model | object | 请求结果数据。 |     |
| OutId | string | 外部流水号。 | 1212312 |
| VerifyResult | string | 短信验证码核验结果。取值： - PASS：短信验证码核验成功。 - UNKNOWN：短信验证码核验失败。 | PASS |
| Code | string | 接口请求状态码。 - 返回 OK 代表请求成功。 - 其他错误码，请参见[返回码](https://help.aliyun.com/zh/pnvs/developer-reference/api-return-code)。 **重要** 接口请求成功不代表短信验证码核验成功，短信验证码核验结果仅以`Model.VerifyResult`参数返回值为准。 | OK  |
| Success | boolean | 接口调用是否成功。取值： - true：接口调用成功。 - false：接口调用失败。 **重要** 接口调用成功不代表短信验证码核验成功，短信验证码核验结果仅以`Model.VerifyResult`参数返回值为准。 | true |
| RequestId | string |     | CF8854E5-DB21-3E5D-A9B1-DDC752FD7384 |

## 示例

正常返回示例

`JSON`格式

```
{
  "AccessDeniedDetail": "无",
  "Message": "成功",
  "Model": {
    "OutId": "1212312",
    "VerifyResult": "PASS"
  },
  "Code": "OK",
  "Success": true,
  "RequestId": "CF8854E5-DB21-3E5D-A9B1-DDC752FD7384"
}
```

## 错误码

访问[错误中心](https://api.aliyun.com/document/Dypnsapi/2017-05-25/errorCode)查看更多错误码。

## **变更历史**

更多信息，参考[变更详情](https://api.aliyun.com/document/Dypnsapi/2017-05-25/CheckSmsVerifyCode#workbench-doc-change-demo)。