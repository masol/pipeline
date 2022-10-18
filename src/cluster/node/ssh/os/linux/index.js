/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: linux

const yaml = require('js-yaml')
const fs = require('fs').promises
const path = require('path')
const utils = require('../../utils')
const srvUtils = require('../../srv/utils')

function getIssue (node) {
  const s = node.$env.soa.s
  const issue = s.trim(node.$info.os.platform).toLowerCase()
  return issue
}
/** 可以采用相同指令集维护的issue */
const issueMapper = {
  centos: 'fedora'
}
function loadIssue (node) {
  const issue = getIssue(node)
  return require(`./issue/${issueMapper[issue] || issue}`)
}

/// 获取Linux下的系统信息。
module.exports.fetch = async function (that) {
  const $info = that.$info
  const term = that.$term
  const { s } = that.$env.soa
  const family = await term.exec('cat /proc/cpuinfo | grep \'model name\' | uniq')
  $info.family = s.trim(s.strRight(family, ':'))
  $info.core = await term.exec('cat /proc/cpuinfo | grep processor | wc -l')
  $info.arch = await term.exec('uname -m')
  // 简易分析，未使用dotenv.
  const osInfos = s.lines(await term.exec('cat /etc/os-release'))
  const osVars = {}
  for (const line of osInfos) {
    const varItem = line.split('=')
    if (varItem.length === 2) {
      osVars[s.trim(varItem[0])] = s.trim(varItem[1])
    }
  }
  $info.os.platform = osVars.ID || osVars.NAME || osVars.PRETTY_NAME || 'Linux'
  $info.os.release = s.unquote(osVars.VERSION_ID || osVars.VERSION || osVars.VERSION_CODENAME || 'Linux' || (await term.exec('uname -r')))
  const memInfos = s.lines(await term.exec('cat /proc/meminfo'))
  $info.mem = {}
  for (const line of memInfos) {
    if (s.startsWith(line, 'MemTotal:')) {
      $info.mem.total = utils.getByte(s, line)
    } else if (s.startsWith(line, 'MemFree:')) {
      $info.mem.free = utils.getByte(s, line)
    }
  }
  const netLines = s.lines(await term.exec('ip addr'))
  $info.net = {}
  let currentName = ''
  for (const line of netLines) {
    if (currentName) {
      const regEx = /\s*inet\s*(\d+\.\d+\.\d+.\d+)\/\d+\s+/
      const found = line.match(regEx)
      if (found && found.length >= 2) {
        // console.log('found = ', found)
        if (currentName !== 'lo') {
          $info.net[currentName] = [found[1]]
        }
        currentName = ''
      }
    } else {
      const regEx = /^\d+:\s+(\S+):\s+<[A-Z,_]+>/
      const found = line.match(regEx)
      if (found && found.length >= 2) {
        // console.log('found if name= ', found)
        currentName = found[1]
      }
    }
  }
}

/**
 *  只有不同发行版名称不同的，才需要加入map.例如apache2入口:
{
  apache2: {
    'centos': 'httpd',
    'fedora': 'httpd'
  }
}
*/
const srvNameMap = {
  postgres: {
    default: 'postgresql'
  }
}
function getSrvName (srvName, issue, _) {
  let realSrvName = srvName
  const srvEntry = srvNameMap[srvName]
  if (_.isObject(srvEntry)) {
    if (_.isString(srvEntry[issue]) && srvEntry[issue]) {
      realSrvName = srvEntry[issue]
    } else if (_.isString(srvEntry.default) && srvEntry.default) {
      realSrvName = srvEntry.default
    }
  } else if (_.isString(srvEntry)) {
    realSrvName = srvEntry
  }
  return realSrvName
}
async function getSrvStatus (node, srvName) {
  const { s, _ } = node.$env.soa
  const term = node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  const issue = getIssue(node)
  const usedName = getSrvName(commonName, issue, _)

  // 默认采用
  let status
  switch (issue) {
    default:{
      // console.log('systemctl status usedName=', `systemctl status ${usedName}`)
      const statusRes = await term.exec(`systemctl status ${usedName}`).catch(e => {
        return false
      })
      // console.log('statusRes=', statusRes)
      if (_.isString(statusRes) && /Active: active/.test(statusRes)) {
        status = true
      } else {
        status = false
      }
    }
  }
  return status
}

// 获取linux下的服务信息。
module.exports.fetchSrv = async function (that, srvName, srv) {
  const status = await getSrvStatus(that, srvName)
  if (!status) {
    srv.status.ok = false
  } else {
    srv.status.ok = true
  }
}

async function loadTop (pathfile) {
  const fileContent = await fs.readFile(pathfile, 'utf-8').catch((e) => '')
  const top = fileContent
    ? yaml.load(fileContent, 'utf8')
    : {
        base: {
          '*': []
        }
      }
  return top
}

// linux下的deployEnv
module.exports.deployEnv = async function (node) {
  const { _, s } = node.$env.soa
  const term = node.$term
  const logfname = `~/install-${new Date().toJSON().slice(0, 10)}.log`
  // console.log('logfname=', logfname)
  const reqMirror = node.$env.args.mirror
  if (reqMirror) {
    // 检查并修改服务器的mirror设置。
    await loadIssue(node).mirror({ logfname, node, term, s })
    // console.log('node=', node)
  }
  let saltCmd = s.trim(await term.exec('which salt-call').catch(e => ''))
  if (!saltCmd) {
    // 安装salt-minion,并且不启动salt服务。
    const localBSFile = '~/bootstrap-salt.sh'
    const mirrorURL = 'https://libs.wware.org/stacksalt/20221004/bootstrap_salt.sh'
    const saltURL = reqMirror ? mirrorURL : 'https://bootstrap.saltstack.com'
    await term.exec(`wget -O ${localBSFile} ${saltURL} 2>&1 | tee -a ${logfname}`).catch(e => false)
    // @TODO: 官方未提供MD5校验码?
    const chk = s.trim(await term.exec(`grep __ScriptVersion= ${localBSFile}`).catch(e => false))
    // console.log('chk=', chk)
    if (!chk) {
      let hasErr = true
      if (!this.opts.args.mirror) { // 切换进入mirror模式重试。
        await term.exec(`wget -O ${localBSFile} ${mirrorURL}  2>&1 | tee -a ${logfname}`).catch(e => false)
        if (s.trim(await term.exec(`grep __ScriptVersion= ${localBSFile}`).catch(e => ''))) {
          hasErr = false
        }
      }
      if (hasErr) {
        throw new Error('无法下载stacksalt的启动脚本')
      }
    }
    await term.exec(`sudo sh ${localBSFile} -X 2>&1 | tee -a ${logfname}`).catch(e => '')
    saltCmd = s.trim(await term.exec('which salt-call').catch(e => ''))
    if (!saltCmd) {
      throw new Error(`节点${node.$name}上,安装salt-minion失败，请查看${logfname}了解详情。`)
    }
  }

  // 确保salt-minion为masterless模式。
  const isLocal = s.trim(await term.exec('grep "file_client: local" /etc/salt/minion').catch(e => ''))
  if (!isLocal) {
    await term.exec('sudo sed -i "s/#file_client: remote/file_client: local/" /etc/salt/minion').catch(e => '')
    if (!s.trim(await term.exec('grep "file_client: local" /etc/salt/minion').catch(e => ''))) {
      throw new Error(`节点${node.$name}上,无法设置salt-minion为masterless模式，请查看${logfname}了解详情。`)
    }
  }
  // 根据服务，创建STATE TREE。
  const sftp = await term.pvftp()

  // const statInfo = await sftp.ensure('/srv/salt')
  // console.log('statInfo=', statInfo)

  const localSalt = await node.$env.tmp.ensure(node.$name, 'salt')
  const localPillar = await node.$env.tmp.ensure(node.$name, 'pillar')
  const localBase = node.$env.tmp.name
  // console.log('localBase=', localBase)
  // 忽略拷贝到本地的错误。会导致意外的覆盖。
  await sftp.cp2Local('/srv/salt', localSalt, srvUtils.saltFilter).catch(e => false)
  await sftp.cp2Local('/srv/pillar', localPillar).catch(e => false)

  // 读取local yml
  const isForce = node.$env.args.force
  const stateTop = await loadTop(path.join(localSalt, 'top.sls'))
  const pillarTop = await loadTop(path.join(localPillar, 'top.sls'))
  const srvTasks = []
  const postTasks = []
  // @TODO: 支持服务的删除。
  _.forEach(node._srvs, (srv, srvName) => {
    // 忽略以$开头的服务。
    if (s.startsWith(srvName, '$')) {
      return
    }
    try {
      const srvFunc = require(`../../srv/${srvName}`).deploy
      // 只有服务未就绪，或者开启了force模式时才执行。
      if (!srv.ok || isForce) {
        srvTasks.push(srvFunc(node, { localBase, stateTop, pillarTop, srvName, srv, postTasks }))
      } else {
        // console.log('ignore srv:', srvName)
      }
    } catch (e) {
      console.log(e)
      throw new Error(`请求了未支持的本地服务:${srvName}`)
    }
  })

  await Promise.all(srvTasks)

  // console.log('compose=', stateTop)
  // console.log('new compose=', yaml.dump(stateTop, { sortKeys: false }))

  await fs.writeFile(path.join(localSalt, 'top.sls'), yaml.dump(stateTop, { sortKeys: false }))
  await fs.writeFile(path.join(localPillar, 'top.sls'), yaml.dump(pillarTop, { sortKeys: false }))

  await sftp.cp2Remote(localSalt, '/srv/salt')
  await sftp.cp2Remote(localPillar, '/srv/pillar')

  // await fs.writeFile()
  // 创建配置。
  // cp2Remote(localpath,'srv/salt)
  // exec('salt-call apply state')
  // const stat = await sftp.lstat('/tmp/test').catch(e => {
  //   console.log('error lstat=', e.code)
  // })
  // console.log('stat=', stat)
  // const dirs = await sftp.fastGet('/etc/salt/minion', '/tmp/test.txt').catch(e => [])
  // console.log('dirs=', dirs)
}
