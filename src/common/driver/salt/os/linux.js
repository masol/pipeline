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

/// 获取Linux下的系统信息。
module.exports.info = async function (driver, { node, term, s, getByte }) {
  const $info = node.$info
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
      $info.mem.total = getByte(s, line)
    } else if (s.startsWith(line, 'MemFree:')) {
      $info.mem.free = getByte(s, line)
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
 apache2: {
  'centos': 'httpd',
  'fedora': 'httpd'
 }
*/
const srvNameMap = {}
// 获取linux下的服务信息。
module.exports.srv = async function (driver, { srvName, srv, node, term }) {
  const { s } = driver.opts.soa
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  const mapEntry = srvNameMap[commonName]
  const issuer = s.trim(node.$info.os.platform).toLowerCase()
  const usedName = mapEntry && mapEntry[issuer]
    ? mapEntry[issuer]
    : commonName
  const status = await term.exec(`systemctl status ${usedName}`).catch(e => {
    return false
  })
  // console.log(usedName, 'status=', status)
  if (!status) {
    srv.status.ok = false
  } else {
    srv.status.ok = true
  }
}

/** 可以采用相同指令集维护的issue */
const osMapper = {
  centos: 'fedora'
}
function getIssue (node) {
  const issue = node.$info.os.platform.toLowerCase()
  return osMapper[issue] || issue
}
// linux下的deployBase
module.exports.deployBase = async function (driver, { name, node, term }) {
  const { s } = driver.opts.soa
  const logfname = `~/install-${new Date().toJSON().slice(0, 10)}.log`
  // console.log('logfname=', logfname)
  if (driver.opts.args.mirror) {
    // 检查并修改服务器的mirror设置。
    await require(`./issue/${getIssue(node)}`).mirror(driver, { logfname, node, term, s })
    // console.log('node=', node)
  }
  let saltCmd = s.trim(await term.exec('which salt-call').catch(e => ''))
  if (!saltCmd) {
    // 安装salt-minion,并且不启动salt服务。
    const localBSFile = '~/bootstrap-salt.sh'
    const mirrorURL = 'https://libs.wware.org/stacksalt/20221004/bootstrap_salt.sh'
    const saltURL = driver.opts.args.mirror ? mirrorURL : 'https://bootstrap.saltstack.com'
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
      throw new Error(`节点${name}上,安装salt-minion失败，请查看${logfname}了解详情。`)
    }
  }

  // 确保salt-minion为masterless模式。
  const isLocal = s.trim(await term.exec('grep "file_client: local" /etc/salt/minion').catch(e => ''))
  if (!isLocal) {
    await term.exec('sudo sed -i "s/#file_client: remote/file_client: local/" /etc/salt/minion').catch(e => '')
    if (!s.trim(await term.exec('grep "file_client: local" /etc/salt/minion').catch(e => ''))) {
      throw new Error(`节点${name}上,无法设置salt-minion为masterless模式，请查看${logfname}了解详情。`)
    }
  }
  // 根据服务，创建STATE TREE。
  const sftp = await term.pvftp()
  // console.log('sftp=', sftp)
  // cp2Local(/srv/salt, ensure('salt'))
  // 读取local yml
  // 创建配置。
  // cp2Remote(localpath,'srv/salt)
  // exec('salt-call apply state')
  const stat = await sftp.lstat('/tmp/test').catch(e => {
    console.log('error lstat=', e.code)
  })
  console.log('stat=', stat)
  const dirs = await sftp.fastGet('/etc/salt/minion', '/tmp/test.txt').catch(e => [])
  console.log('dirs=', dirs)
}
