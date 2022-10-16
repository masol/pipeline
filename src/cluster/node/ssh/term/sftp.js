/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 14 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: sftp

const Stats = require('./stats')
const fs = require('fs').promises
const path = require('path')

function linuxPath (method, args) {
  const syssep = path.sep
  path.sep = '/'
  const ret = path[method].apply(path, args)
  path.sep = syssep
  return ret
}

async function ensurePath (sftp, filepath) {
  // @TODO: normalize path here.
  filepath = linuxPath('normalize', [filepath])

  const pathParts = String(filepath).split('/')
  let statInfo = await sftp.stat(filepath).catch(e => false)
  if (!statInfo) {
    const bExistPath = []
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      bExistPath.push(part)
      if (!part) {
        continue
      }
      const nextPath = bExistPath.join('/')
      statInfo = await sftp.stat(nextPath).catch(async e => {
        await sftp.mkdir(nextPath)
        return await sftp.stat(nextPath)
      })
    }
  }
  return statInfo
}

async function cp2lGather (sftp, remote, local, opts) {
  const { ctx, _, s, filter } = opts
  // 返回true表示继续。filter只处理文件，目录会全部保存。
  const filterHandler = _.isFunction(filter) ? filter : () => true
  const dirs = await sftp.readdir(remote).catch(e => {
    if (e.code === 2) { // 忽略不存在的错误。
      return []
    }
    throw e
  })
  // console.log('sftp.Stats=', sftp)
  for (const item of dirs) {
    const entry = new Stats(item.attrs)
    if (entry.isDirectory()) {
      const dirName = linuxPath('join', [remote, item.filename, '/'])
      // 由于顺序遍历，dirName只能是dirTasks中的子目录。
      _.remove(ctx.dirTasks, (n) => {
        return s.startsWith(dirName, n.remote)
      })
      ctx.dirTasks.push({
        remote: dirName,
        local: path.join(local, item.filename)
      })
      await cp2lGather(sftp, dirName, path.join(local, item.filename), opts)
    } else if (entry.isFile()) {
      if (!filterHandler(remote, item)) { // 不处理此节点，继续。
        continue
      }
      ctx.cpTasks.push({
        remote: linuxPath('join', [remote, item.filename]),
        local: path.join(local, item.filename)
      })
    } else if (entry.isSymbolicLink()) {
      console.log('忽略符号链接拷贝请求:', item)
    } else {
      throw new Error(`远端文件${item.filename}不被支持!`)
    }
  }
}

async function cp2Local (sftp, remote, local, envOpts, filter) {
  const ctx = {
    dirTasks: [],
    cpTasks: []
  }
  const { _, s, $ } = envOpts.soa
  await cp2lGather(sftp, remote, local, { ctx, _, s, filter })
  const limit = parseInt(envOpts.args.concurrency) || 5
  await $.mapLimit(ctx.dirTasks, limit, (item) => {
    return fs.access(item.local, fs.constants.F_OK)
      .then(() => true)
      .catch(async (e) => {
        return fs.mkdir(item.local, { recursive: true })
      })
  })
  await $.mapLimit(ctx.cpTasks, limit, (item) => {
    return sftp.fastGet(item.remote, item.local)
  })
  // console.log('ctx.dirTasks=', ctx.dirTasks)
  // console.log('ctx.cpTasks=', ctx.cpTasks)
}

async function cp2Remote (sftp, local, remote, envOpts, filter) {
}

module.exports.ensurePath = ensurePath
module.exports.cp2Local = cp2Local
module.exports.cp2Remote = cp2Remote
