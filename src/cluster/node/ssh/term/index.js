/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: term

const fs = require('fs').promises
const path = require('path')
const SSH2Promise = require('ssh2-promise')
const sftpUtil = require('./sftp')

const $VaultPrefix = '$vault:'

async function getConf (envOpts, definition) {
  const cfgutil = envOpts.config.util
  const { s } = envOpts.soa
  const secretPath = cfgutil.path('pvdev', 'cluster', envOpts.args.target, 'secret')
  const secretMap = JSON.parse(await fs.readFile(path.join(secretPath, 'secret.json'), 'utf8').catch(e => {
    return '{}'
  }))
  if (!definition.host) {
    throw new Error('ssh节点必须指定host。')
  }
  const conf = {
    host: definition.host,
    port: definition.port || 22,
    username: definition.username || 'root'
  }
  const passwd = (s.startsWith(definition.password, $VaultPrefix)
    ? secretMap[s.strRight(definition.password, ':')]
    : definition.password)
  if (!passwd && !definition.key) {
    throw new Error('ssh节点必须指定密码或证书中的一个')
  }
  if (passwd) {
    conf.password = passwd
  } else {
    conf.privateKey = await fs.readFile(path.join(secretPath, definition.key))
  }
  return conf
}

function pvftp (term, envOpts) {
  let inst = null
  return async function () {
    if (!inst) {
      inst = await term.sftp()
      // 为inst添加几个便捷函数。
      // 1. 递归创建目录。
      inst.ensure = async (path) => {
        return await sftpUtil.ensurePath(inst, path)
      }
      inst.cp2Local = async (remote, local, filter) => {
        await sftpUtil.cp2Local(inst, remote, local, envOpts, filter)
      }
      inst.cp2Remote = async (local, remote, filter) => {
        return await sftpUtil.cp2Remote(inst, local, remote, envOpts, filter)
      }
    }
    return inst
  }
}

/**
   *
   * @param {Object} expect 交互过程抽象:定义如下:
{
  start: action(socket)
  close: action(socket)
  err: action(socket,err) 如果未定义，发生错误时抛出异常。
  out: [
    {
      mode: 'expect'(下一行必须满足) | 'wait'(等待此行出现)
      exp: '' //expectation:期望的内容，正则或字符串。
      action: 回调函数(socket,line,regExResult): 返回'keep'继续检查此条，否则移除，检查下一条。
      err: 回调函数，只有是expect，并且下一行不满足expectation，则调用此函数。如果不存在，抛出异常。
    }
  ]
  opts: {
    stripColors: true,
    trim: true, //将每行trim,空行不再执行期望检查。
    strict: false //严格模式，所有的输出都必须被匹配处理，否则抛出错误。
  }
}
   */
async function procExpect (socket, expect = {}, envOpts, cmdline) {
  const { _, s, $ } = envOpts.soa
  const opts = expect.opts || {
    stripColors: true,
    trim: true,
    strict: false
  }
  const out = _.clone(expect.out) || []
  return new Promise((resolve, reject) => {
    // 当前执行的task,以支持异步回调。
    let currTask = null
    let lines
    let bProc = false
    const callFunc = async (handler, param) => {
      return Promise.resolve(currTask).then((result) => {
        currTask = result
        if (_.isFunction(handler)) {
          currTask = handler(socket, param)
        }
        return Promise.resolve(currTask)
      })
    }
    const testExpectation = (line, expectation) => {
      if (_.isArray(expectation)) {
        return !!_.find(expectation, (exp) => {
          return testExpectation(line, exp)
        })
      }
      if (_.isRegExp(expectation)) {
        return expectation.test(line)
      }
      return String(line).indexOf(expectation) > -1
    }
    const evalContext = (line) => {
      if (out.length === 0) {
        if (opts.strict) {
          throw new Error('pvexec:新的输出，但是没有期望的匹配。')
        }
        return
      }
      const procInfo = out[0]
      const procActionRet = (task) => {
        if ($.isPromise(task)) {
          return Promise.resolve(task).then((result) => {
            if (result !== 'keep') {
              out.shift()
            }
          })
        } else if (task !== 'keep') {
          out.shift()
        }
      }
      if (testExpectation(line, procInfo.exp)) {
        let task
        if (_.isFunction(procInfo.action)) {
          task = procInfo.action(socket, line)
        }
        return procActionRet(task)
      } else {
        if (procInfo.mode === 'expect') {
          if (_.isFunction(procInfo.err)) {
            procActionRet(procInfo.err(socket, line))
          } else {
            reject(new Error('无法匹配Expect。'))
          }
        }
      }
    }

    const procLines = async () => {
      bProc = true
      while (lines.length > 0) {
        let line = lines.shift()
        if (opts.trim) {
          line = s.trim(line)
        }
        if (!line) {
          continue
        }
        await currTask
        currTask = evalContext(line)
      }
    }
    if (_.isFunction(expect.start)) {
      currTask = expect.start(socket)
    }
    socket.on('error', (err) => {
      if (!expect.err) {
        reject(err)
      } else {
        callFunc(expect.err)
      }
    })
    socket.on('data', (data) => {
      data = data.toString()
      if (opts.stripColors) {
        // eslint-disable-next-line no-control-regex
        data = data.replace(/\u001b\[\d{0,2}m/g, '')
      }
      // console.log('on data=', data)
      lines = _.concat(lines, s.lines(data))
      if (!bProc) {
        procLines()
      }
    })
    socket.on('close', () => {
      // console.log('on close=')
      callFunc(expect.close).then((result) => {
        resolve(result)
      })
    })
    socket.write(cmdline + '\nexit\n')
  })
}

module.exports.create = async (envOpts, node) => {
  const definition = node.$definition
  const hop = definition.hop || []
  let conf = await getConf(envOpts, definition)
  if (hop.length > 0) {
    const nodes = envOpts.deployer.nodes
    const hopConf = []
    hopConf.push(conf)
    for (let i = 0; i < hop.length; i++) {
      const hopNode = nodes[hop[i]]
      if (!hopNode) {
        throw new Error(`请求Hop方式连接,但是中间节点${hop[i]}不存在。`)
      }
      const conf = await getConf(envOpts, hopNode)
      hopConf.push(conf)
    }
    conf = hopConf
  }
  const sshInst = new SSH2Promise(conf)
  await sshInst.connect()
  sshInst.pvftp = pvftp(sshInst, envOpts)
  sshInst.pvexec = async (cmdline, expect) => {
    const socket = await sshInst.shell()
    return await procExpect(socket, expect, envOpts, cmdline)
  }
  return sshInst
}
