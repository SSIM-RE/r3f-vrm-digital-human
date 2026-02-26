// 简单的 VRM 控制 API
// 运行方式: node vrm-api.js (需要先启动 VRM 项目)

// 使用 fetch 发送命令到 VRM 页面
async function sendCommand(command) {
  // 方法1: 使用 localStorage 事件 (同浏览器)
  localStorage.setItem('vrm-command', JSON.stringify({
    command,
    timestamp: Date.now()
  }));
  
  // 触发 storage 事件
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'vrm-command',
    newValue: JSON.stringify({ command, timestamp: Date.now() })
  }));
}

// 预设命令
const commands = {
  '笑': () => sendCommand('笑一个'),
  '哭': () => sendCommand('难过'),
  '生气': () => sendCommand('生气'),
  '惊讶': () => sendCommand('惊讶'),
  '打招呼': () => sendCommand('打招呼'),
  '挥手': () => sendCommand('挥手'),
  '跳舞': () => sendCommand('跳舞'),
  '看我': () => sendCommand('看过来'),
  '别看': () => sendCommand('别看'),
};

// 导出给 Node.js 使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendCommand, commands };
}

console.log('VRM 控制 API 已加载');
console.log('可用命令:', Object.keys(commands).join(', '));
