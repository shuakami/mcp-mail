import * as fs from 'fs';
import * as path from 'path';

// 锁文件路径配置
const LOCK_FILE = path.join(process.cwd(), '.mcp-mail.lock');

export class ProcessManager {
  private instanceId: string;

  constructor() {
    // 生成唯一实例ID
    this.instanceId = Date.now().toString();
    
    // 注册进程退出处理
    this.registerCleanup();
  }

  private registerCleanup(): void {
    // 注册多个信号以确保清理
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  private cleanup(): void {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        // 只清理自己的锁文件
        if (lockData.instanceId === this.instanceId) {
          fs.unlinkSync(LOCK_FILE);
          console.log('已清理进程锁文件');
        }
      }
    } catch (error) {
      console.error('清理锁文件时出错:', error);
    }
  }

  private async waitForProcessExit(pid: number, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        process.kill(pid, 0);
        // 进程还在运行，等待100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // 进程已退出
        return true;
      }
    }
    return false;
  }

  public async checkAndCreateLock(): Promise<boolean> {
    try {
      // 检查锁文件是否存在
      if (fs.existsSync(LOCK_FILE)) {
        const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        
        try {
          // 检查进程是否还在运行
          process.kill(lockData.pid, 0);
          console.log('检测到已有MCP实例运行，发送终止信号');
          // 发送终止信号
          process.kill(lockData.pid, 'SIGTERM');
          
          // 等待旧进程退出
          console.log('等待旧实例退出...');
          const exited = await this.waitForProcessExit(lockData.pid);
          if (!exited) {
            console.error('等待旧实例退出超时');
            return false;
          }
          
          // 删除旧的锁文件
          fs.unlinkSync(LOCK_FILE);
        } catch (e) {
          // 进程不存在，删除过期的锁文件
          console.log('检测到过期的锁文件，将创建新实例');
          fs.unlinkSync(LOCK_FILE);
        }
      }

      // 创建新的锁文件
      fs.writeFileSync(LOCK_FILE, JSON.stringify({
        pid: process.pid,
        instanceId: this.instanceId,
        timestamp: Date.now()
      }));

      console.log('已创建MCP实例锁文件');
      return true;
    } catch (error) {
      console.error('处理锁文件时出错:', error);
      return false;
    }
  }
} 