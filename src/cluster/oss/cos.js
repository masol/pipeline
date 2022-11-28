/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 25 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: cos

const CosSDK = require('cos-nodejs-sdk-v5')
const Base = require('./base')
const path = require('path')
const fse = require('fs-extra')

class Cos extends Base {
  #inst
  constructor (def, cluster) {
    super(def, cluster)
    // 可用参数参考 https://cloud.tencent.com/document/product/436/8629
    const conf = {
      SecretId: def.conf.accessKeyId,
      SecretKey: def.conf.secretAccessKey,
      ForcePathStyle: def.conf.ForcePathStyle || false,
      UseAccelerate: def.conf.UseAccelerate || true
    }
    this.#inst = new CosSDK(conf)
  }

  async deploy (srcDir) {
    const that = this
    const files = []
    const { $, s } = that.$cluster.envs.soa
    await that.gatherFiles(srcDir, files)
    const limit = parseInt(that.$cluster.envs.args.concurrency) || 5
    await $.mapLimit(files, limit, async (filePath) => {
      const length = (await fse.stat(filePath)).size
      const key = path.relative(srcDir, filePath)
      // console.log('length=', length)
      // console.log('fileName=', filePath)
      // console.log('key=', key)
      return new Promise((resolve, reject) => {
        const opts = {
          Bucket: that.$def.bucket,
          Region: that.$def.conf.region,
          Key: key,
          StorageClass: 'STANDARD',
          Body: fse.createReadStream(filePath), // 上传文件对象
          ContentLength: length
        }
        if (s.startsWith(key, '_app/immutable')) {
          opts.CacheControl = 'public,max-age=2147483647,immutable'
        } else {
          // @TODO: 这里使用命令行参数可调整默认资源的缓冲时间。
          opts.CacheControl = 'public,max-age=300' // 5 min
        }
        that.#inst.putObject(opts, (err, data) => {
          if (err) {
            reject(err)
          } else {
            // console.log(data)
            resolve(data)
          }
        })
      })
    })
  }

  version () {
    const that = this
    return new Promise((resolve, reject) => {
      const opts = {
        Bucket: that.$def.bucket,
        Region: that.$def.conf.region,
        Key: 'version.txt'
      }
      that.#inst.getObject(opts, (err, data) => {
        if (err) {
          if (err.code === 'NoSuchKey') {
            resolve('')
          } else {
            reject(err)
          }
        } else {
          const dateStr = data.Body.toString('utf-8')
          // console.log(dateStr)
          resolve(dateStr)
        }
      })
    })
  }

  list (prefix) {
    const that = this
    return new Promise((resolve, reject) => {
      const opts = (typeof prefix === 'object')
        ? prefix
        : {
            prefix
          }
      opts.Bucket = opts.Bucket || that.$def.bucket
      opts.Region = opts.Region || that.$def.conf.region
      that.#inst.getBucket(opts, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })
  }
}

module.exports = Cos
