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
const crc64 = require('crc64-ecma182')
const logger = require('fancy-log')

class Cos extends Base {
  #inst
  #threshold
  constructor (def, cluster) {
    super(def, cluster)
    // 可用参数参考 https://cloud.tencent.com/document/product/436/8629
    const conf = {
      SecretId: def.conf.accessKeyId,
      SecretKey: def.conf.secretAccessKey,
      ForcePathStyle: def.conf.ForcePathStyle || false,
      UseAccelerate: def.conf.UseAccelerate || true
    }
    const { _ } = this.$cluster.envs.soa
    this.#threshold = parseInt(def.threshold)
    if (!_.isInteger(this.#threshold) || this.#threshold < 0) {
      this.#threshold = 100 * 1024 // 默认阀值100K.
    }
    // console.log('this.#threshold=', this.#threshold)
    this.#inst = new CosSDK(conf)
  }

  async deploy (srcDir) {
    const that = this
    const files = []
    const { $, s } = that.$cluster.envs.soa
    await that.gatherFiles(srcDir, files)
    const limit = parseInt(that.$cluster.envs.args.concurrency) || 5
    const bVerbose = that.$cluster.envs.args.verbose
    await $.mapLimit(files, limit, async (filePath) => {
      const stat = await fse.stat(filePath)
      const length = stat.size
      const key = path.relative(srcDir, filePath)
      // console.log('length=', length)
      // console.log('fileName=', filePath)
      // console.log('key=', key)
      return new Promise((resolve, reject) => {
        const putObject = () => {
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
        }
        if (length > that.#threshold) { // 大于阀值的文件，检查是否需要更新。
          crc64.crc64File(filePath, (err, crcval) => {
            if (err) {
              putObject()
            } else {
              // console.log('crcval=', crcval)
              that.#inst.headObject({
                Bucket: that.$def.bucket,
                Region: that.$def.conf.region,
                Key: key
              }, (err, data) => {
                if (err) {
                  // console.log('headObject err=', err)
                  putObject()
                } else {
                  const serverCrc = data.headers['x-cos-hash-crc64ecma']
                  if (serverCrc !== crcval) {
                    if (bVerbose) {
                      logger(`大文件"${key}"的CRC发生变化，重新上传。`)
                    }
                    putObject()
                  } else {
                    if (bVerbose) {
                      logger(`大文件"${key}"未变化，忽略上传。`)
                    }
                    resolve(true)
                  }
                }
              })
            }
          })
        } else {
          putObject()
        }
      })
    })
  }

  // version () {
  //   const that = this
  //   return new Promise((resolve, reject) => {
  //     const opts = {
  //       Bucket: that.$def.bucket,
  //       Region: that.$def.conf.region
  //     }
  //     that.#inst.getBucketTagging(opts, (err, data) => {
  //       if (err) {
  //         reject(err)
  //       } else {
  //         console.log(err || data)
  //         resolve('')
  //       }
  //     })
  //   })
  // }

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
