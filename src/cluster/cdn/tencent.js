/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 27 Dec 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: tencent

const tencentcloud = require('tencentcloud-sdk-nodejs')
const Base = require('./base')

// 检查腾讯sdk提供的client.
// console.log('tencentcloud=', tencentcloud)

class Tencent extends Base {
  #inst
  constructor (def, cluster) {
    super(def, cluster)
    // 可用参数参考 https://cloud.tencent.com/document/product/436/8629
    const conf = {
      credential: {
        secretId: def.conf.accessKeyId,
        secretKey: def.conf.secretAccessKey
      }
    }
    // this.#inst = new CosSDK(conf)
    const CdnClient = tencentcloud.cdn.v20180606.Client
    this.#inst = new CdnClient(conf)
  }

  async purgePath (pathes) {
    return this.#inst.PurgePathCache({
      Paths: pathes,
      FlushType: 'flush',
      UrlEncode: true
    })
  }

  // 检查指定domains是否已被cdn加速.
  chkDomains (domains) {
    /**
 const domains = this.#inst.DescribeDomains()
    domains.then((data) => {
      console.log('domains = ', data)
    })
domains =  {
  RequestId: '6c505257-ecdc-4323-8b17-6ca46193f249',
  Domains: [
    {
      AppId: 1313478131,
      Area: 'mainland',
      Cname: 'www.pinyan.tech.cdn.dnsv1.com',
      CreateTime: '2022-11-28 13:07:19',
      Disable: 'normal',
      Domain: 'www.pinyan.tech',
      Origin: [Object],
      ParentHost: '',
      Product: 'cdn',
      ProjectId: 0,
      Readonly: 'normal',
      ResourceId: 'cdn-na5jxmn3',
      ServiceType: 'web',
      Status: 'online',
      UpdateTime: '2022-11-28 13:27:13'
    },
    {
      AppId: 1313478131,
      Area: 'mainland',
      Cname: 'pinyan.tech.cdn.dnsv1.com',
      CreateTime: '2022-11-28 13:07:09',
      Disable: 'normal',
      Domain: 'pinyan.tech',
      Origin: [Object],
      ParentHost: '',
      Product: 'cdn',
      ProjectId: 0,
      Readonly: 'normal',
      ResourceId: 'cdn-5onmx6u0',
      ServiceType: 'web',
      Status: 'online',
      UpdateTime: '2022-11-28 13:29:32'
    },
    {
      AppId: 1313478131,
      Area: 'mainland',
      Cname: 'munao.cc.cdn.dnsv1.com',
      CreateTime: '2022-11-24 16:43:56',
      Disable: 'normal',
      Domain: 'munao.cc',
      Origin: [Object],
      ParentHost: '',
      Product: 'cdn',
      ProjectId: 0,
      Readonly: 'normal',
      ResourceId: 'cdn-2m7krlf6',
      ServiceType: 'web',
      Status: 'online',
      UpdateTime: '2022-11-28 13:25:52'
    },
    {
      AppId: 1313478131,
      Area: 'mainland',
      Cname: 'www.munao.cc.cdn.dnsv1.com',
      CreateTime: '2022-11-16 17:04:00',
      Disable: 'normal',
      Domain: 'www.munao.cc',
      Origin: [Object],
      ParentHost: '',
      Product: 'cdn',
      ProjectId: 0,
      Readonly: 'normal',
      ResourceId: 'cdn-c4xokj7v',
      ServiceType: 'web',
      Status: 'online',
      UpdateTime: '2022-11-28 13:25:52'
    }
  ],
  TotalNumber: 4
}
 */
  }
}

module.exports = Tencent
