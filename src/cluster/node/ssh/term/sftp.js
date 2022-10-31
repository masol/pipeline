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

async function cp2rGather (sftp, local, remote, opts) {
  const { ctx, _, s } = opts
  // 返回true表示继续。filter只处理文件，目录会全部保存。
  // console.log('read local=', local)
  const dirs = await fs.readdir(local).catch(e => {
    if (e.code === 2) { // 忽略不存在的错误。
      return []
    }
    throw e
  })
  // console.log('cp2 local dirs=', dirs)
  for (const item of dirs) {
    // console.log('item=', item)
    // 不使用lstat,忽略link.
    const fullItem = path.join(local, item)
    const stats = await fs.stat(fullItem)
    // console.log('stats=', stats)
    if (stats.isDirectory()) {
      // 由于顺序遍历，dirName只能是dirTasks中的子目录。
      _.remove(ctx.dirTasks, (n) => {
        return s.startsWith(fullItem, n.local)
      })
      const remoteDir = linuxPath('join', [remote, item])
      ctx.dirTasks.push({
        remote: remoteDir,
        local: path.join(fullItem, path.sep)
      })
      await cp2rGather(sftp, fullItem, remoteDir, opts)
    } else if (stats.isFile()) {
      // 加入文件拷贝任务。
      ctx.cpTasks.push({
        remote: linuxPath('join', [remote, item]),
        local: fullItem
      })
    } else if (stats.isSymbolicLink()) {
      console.log('忽略符号链接拷贝请求:', fullItem)
    } else {
      throw new Error(`本地文件${fullItem}不被支持!`)
    }
  }
}

// 递归创建目录。
async function sftpMkdir (sftp, remote) {
  return await sftp.mkdir(remote).catch(async e => {
    if (e.code === 2) { // 不存在。
      return await sftpMkdir(sftp, linuxPath('dirname', [remote]))
    } else if (e.code === 4) { // 已存在。
      return []
    }
    console.log('mkdir error:', remote)
    console.log(e)
    throw e // 其它错误。
  })
  // console.log('mkdir result=', result)
}

async function cp2Remote (sftp, local, remote, envOpts) {
  const ctx = {
    dirTasks: [{ local: path.join(local, path.sep), remote }],
    cpTasks: []
  }
  // console.log('before cp2rgather,tasks=', ctx)
  const { _, s, $ } = envOpts.soa
  await cp2rGather(sftp, local, remote, { ctx, _, s })
  // console.log('after cp2rgather,tasks=')
  console.log(ctx.dirTasks)
  console.log(ctx.cpTasks)
  const limit = parseInt(envOpts.args.concurrency) || 5
  await $.mapLimit(ctx.dirTasks, limit, async (item) => {
    // console.log('sftpmkdir=', item.remote)
    return await sftpMkdir(sftp, item.remote)
  })

  await $.mapLimit(ctx.cpTasks, limit, async (item) => {
    return await sftp.fastPut(item.local, item.remote)
  })
}

module.exports.ensurePath = ensurePath
module.exports.cp2Local = cp2Local
module.exports.cp2Remote = cp2Remote
