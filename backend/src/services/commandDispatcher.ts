// ================================================================
// 多平台服务器命令模板
// 支持：Linux / Windows / FreeBSD / macOS / Solaris / AIX
// ================================================================

export type OSType =
  | 'linux'
  | 'windows'
  | 'freebsd'
  | 'macos'
  | 'solaris'
  | 'aix'
  | 'unknown';

export interface CommandTemplates {
  info: {
    os: string;
    cpu_cores: string;
    memory_gb: string;
    disk_gb: string;
    ip_address: string;
  };
  metrics: {
    cpu_usage: string;
    memory: string;
    disk: string;
    network: string;
    load: string;
    uptime: string;
  };
  compliance: {
    cpu: string;
    memory: string;
    disk: string;
    network: string;
    users: string;
    services: string;
    uptime: string;
    os_info: string;
  };
  // 新增：安全基线检查项
  security: {
    listening_ports: string;      // 监听端口
    open_files: string;           // 开放文件描述符
    failed_logins: string;        // 登录失败记录
    root_ssh_keys: string;        // root 授权密钥
    world_writable_files: string; // 全局可写文件扫描（局限）
    firewall_status: string;      // 防火墙状态
    selinux_status: string;       // SELinux / AppArmor
  };
  // 新增：GPU/NVIDIA 指标
  gpu?: {
    gpu_count: string;
    gpu_utilization: string;
    gpu_memory: string;
    gpu_temperature: string;
  };
}

// ── Linux ──
const LinuxTemplates: CommandTemplates = {
  info: {
    os: "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | cut -d'=' -f2 | tr -d '\"' || cat /etc/redhat-release 2>/dev/null || uname -o",
    cpu_cores: "nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 0",
    memory_gb: "free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo 0",
    disk_gb: "df -BG 2>/dev/null | awk '/^\\//{sum+=$2}END{print int(sum)}' || echo 0",
    ip_address: "hostname -I 2>/dev/null | awk '{print $1}' || echo ''",
  },
  metrics: {
    cpu_usage: "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}' || mpstat 2>/dev/null | tail -1 | awk '{print 100 - $NF}' || echo 0",
    memory: "free -m | awk '/^Mem:/{printf \"%.1f %.1f %.1f\", $2/1024, $3/1024, $3*100/$2}'",
    disk: "df -m --output=source,size,used,pcent / 2>/dev/null | tail -1 | awk '{print $2/1024, $3/1024, $4}' || df -BM / | tail -1 | awk '{print $2, $3, $5}'",
    network: "cat /proc/net/dev 2>/dev/null | grep -v lo: | awk 'NR>2 {rx+=$2; tx+=$10} END {printf \"%.2f %.2f\", rx/1024/1024, tx/1024/1024}' || echo \"0 0\"",
    load: "cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || uptime | awk -F'load average:' '{print $2}'",
    uptime: "cat /proc/uptime 2>/dev/null | awk '{print int($1)}' || echo 0",
  },
  compliance: {
    cpu: 'top -bn1 | head -20',
    memory: 'free -h && cat /proc/meminfo | head -20',
    disk: 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20',
    network: 'ip addr && netstat -tulpn 2>/dev/null || ss -tulpn',
    users: "cat /etc/passwd | cut -d: -f1,3,6,7",
    services: 'systemctl list-units --type=service --state=running 2>/dev/null || service --status-all 2>&1 | grep "+"',
    uptime: 'uptime && w',
    os_info: 'cat /etc/os-release && uname -a',
  },
  security: {
    listening_ports: 'ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || echo "unavailable"',
    open_files: 'cat /proc/sys/fs/file-nr 2>/dev/null || echo 0',
    failed_logins: 'lastb 2>/dev/null | head -20 || echo "no failed login data"',
    root_ssh_keys: 'cat /root/.ssh/authorized_keys 2>/dev/null | head -5 || echo "no root ssh keys"',
    world_writable_files: "find / -maxdepth 3 -type f -perm -0002 2>/dev/null | head -20 || echo ''",
    firewall_status: 'ufw status 2>/dev/null || firewall-cmd --state 2>/dev/null || iptables -L -n 2>/dev/null | head -10 || echo "unmanaged"',
    selinux_status: 'getenforce 2>/dev/null || cat /sys/kernel/security/apparmor/profiles 2>/dev/null | head -3 || echo "unknown"',
  },
  gpu: {
    gpu_count: "nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l || echo 0",
    gpu_utilization: "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | paste -s -d',' || echo 0",
    gpu_memory: "nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | paste -s -d',' || echo '0,0'",
    gpu_temperature: "nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null | paste -s -d',' || echo 0",
  },
};

// ── Windows ──
const WindowsTemplates: CommandTemplates = {
  info: {
    os: "powershell -Command \"(Get-CimInstance Win32_OperatingSystem).Caption\"",
    cpu_cores: "powershell -Command \"(Get-CimInstance Win32_Processor).NumberOfCores\"",
    memory_gb: "powershell -Command \"[math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 1)\"",
    disk_gb: "powershell -Command \"$total = 0; Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object { $total += $_.Size }; [math]::Round($total / 1GB, 1)\"",
    ip_address: "powershell -Command \"(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.IPAddress.StartsWith('127.') } | Select-Object -First 1).IPAddress\"",
  },
  metrics: {
    cpu_usage: "powershell -Command \"(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue\"",
    memory: "powershell -Command \"$os = Get-CimInstance Win32_OperatingSystem; $t = $os.TotalVisibleMemorySize / 1MB; $f = $os.FreePhysicalMemory / 1MB; $u = $t - $f; $p = ($u / $t) * 100; Write-Output \\\"$t $u $p\\\"\"",
    disk: "powershell -Command \"$d = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID -eq 'C:' }; $t = [math]::Round($d.Size / 1GB, 2); $u = [math]::Round(($d.Size - $d.FreeSpace) / 1GB, 2); $p = [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 1); Write-Output \\\"$t $u $p\\\"\"",
    network: "powershell -Command \"$s = Get-NetAdapterStatistics -Name '*' | Where-Object { $_.Name -notlike '*Loopback*' }; $rx = 0; $tx = 0; $s | ForEach-Object { $rx += $_.ReceivedBytes; $tx += $_.SentBytes }; Write-Output \\\"$([math]::Round($rx / 1MB, 2)) $([math]::Round($tx / 1MB, 2))\\\"\"",
    load: "powershell -Command \"Write-Output '0 0 0'\"",
    uptime: "powershell -Command \"$u = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime; Write-Output $u.TotalSeconds\"",
  },
  compliance: {
    cpu: 'powershell -Command "Get-Counter \'\\Processor(_Total)\\% Processor Time\' -SampleInterval 1 -MaxSamples 3"',
    memory: 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory; Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Name, WorkingSet"',
    disk: 'powershell -Command "Get-CimInstance Win32_LogicalDisk | Where-Object DriveType -eq 3 | Select-Object DeviceID, Size, FreeSpace"',
    network: 'powershell -Command "Get-NetIPAddress; Get-NetAdapter; Get-NetTCPConnection -State Listen"',
    users: 'powershell -Command "Get-LocalUser | Select-Object Name, Enabled, LastLogon"',
    services: 'powershell -Command "Get-Service | Where-Object Status -eq Running | Select-Object Name, DisplayName, Status"',
    uptime: 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime; (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime"',
    os_info: 'powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber"',
  },
  security: {
    listening_ports: 'powershell -Command "Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess"',
    open_files: 'powershell -Command "Get-Process | Measure-Object | Select-Object Count"',
    failed_logins: 'powershell -Command "Get-EventLog -LogName Security -InstanceId 4625 -Newest 20 2>$null | Select-Object TimeGenerated, Message"',
    root_ssh_keys: 'powershell -Command "Get-Content $env:ProgramData\\ssh\\administrators_authorized_keys 2>$null | Select-Object -First 5"',
    world_writable_files: 'powershell -Command "Write-Output \'N/A on Windows\'"',
    firewall_status: 'powershell -Command "Get-NetFirewallProfile | Select-Object Name, Enabled"',
    selinux_status: 'powershell -Command "Write-Output \'N/A on Windows\'"',
  },
};

// ── FreeBSD ──
const FreeBSDTemplates: CommandTemplates = {
  info: {
    os: 'uname -sr && freebsd-version 2>/dev/null',
    cpu_cores: "sysctl -n hw.ncpu 2>/dev/null || echo 0",
    memory_gb: "sysctl -n hw.realmem 2>/dev/null | awk '{printf \"%.1f\", $1/1073741824}' || echo 0",
    disk_gb: "df -BG 2>/dev/null | awk '/^\\//{sum+=$2}END{print int(sum)}' || echo 0",
    ip_address: "ifconfig 2>/dev/null | grep -E '^[a-z]' | head -1 | xargs -I{} ifconfig {} inet 2>/dev/null | grep 'inet ' | awk '{print $2}' | head -1 || hostname -I 2>/dev/null | awk '{print $1}'",
  },
  metrics: {
    cpu_usage: "top -b -n 1 2>/dev/null | grep 'CPU:' | awk '{print 100 - $7}' || echo 0",
    memory: "sysctl -n hw.physmem hw.pagesize 2>/dev/null | paste - - | awk '{t=$1/1073741824; u=0; p=0; printf \"%.1f %.1f %.1f\", t, u, p}' || echo '0 0 0'",
    disk: "df -m / 2>/dev/null | tail -1 | awk '{print $2/1024, $3/1024, $5}'",
    network: "netstat -ib 2>/dev/null | grep -v lo0 | awk 'NR>1 {rx+=$7; tx+=$10} END {printf \"%.2f %.2f\", rx/1024/1024, tx/1024/1024}' || echo '0 0'",
    load: "sysctl -n vm.loadavg 2>/dev/null | awk '{print $2, $3, $4}' || uptime | awk -F'load averages:' '{print $2}'",
    uptime: "sysctl -n kern.boottime 2>/dev/null | awk -F'[= ,]' '{print $4}' | xargs -I{} sh -c 'echo $(($(date +%s)-{}))' || echo 0",
  },
  compliance: {
    cpu: 'top -b -n 1 | head -20',
    memory: 'sysctl hw.physmem hw.pagesize && vmstat -s | head -20',
    disk: 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20',
    network: 'ifconfig && netstat -rn',
    users: 'cat /etc/passwd | cut -d: -f1,3,6,7',
    services: 'service -e 2>/dev/null | head -30 || systemctl list-units --type=service --state=running 2>/dev/null | head -20',
    uptime: 'uptime && who',
    os_info: 'uname -a && freebsd-version',
  },
  security: {
    listening_ports: 'sockstat -4 -l 2>/dev/null | head -30 || netstat -an -f inet | grep LISTEN | head -20',
    open_files: 'sysctl -n kern.maxfiles kern.openfiles 2>/dev/null || echo "0 0"',
    failed_logins: 'cat /var/log/auth.log 2>/dev/null | grep "Failed password" | tail -20 || lastb 2>/dev/null | head -20 || echo "no data"',
    root_ssh_keys: 'cat /root/.ssh/authorized_keys 2>/dev/null | head -5 || echo ""',
    world_writable_files: "find / -maxdepth 3 -type f -perm -0002 2>/dev/null | head -20 || echo ''",
    firewall_status: 'pfctl -s info 2>/dev/null | head -5 || ipfw show 2>/dev/null | head -5 || echo "no fw info"',
    selinux_status: 'echo "N/A on FreeBSD"',
  },
};

// ── macOS (Darwin) ──
const MacosTemplates: CommandTemplates = {
  info: {
    os: 'sw_vers -productName && sw_vers -productVersion',
    cpu_cores: "sysctl -n hw.ncpu 2>/dev/null || echo 0",
    memory_gb: "sysctl -n hw.memsize 2>/dev/null | awk '{printf \"%.1f\", $1/1073741824}' || echo 0",
    disk_gb: "df -BG 2>/dev/null | awk '/^\\//{if(NR>1)sum+=$2}END{print int(sum)}' || echo 0",
    ip_address: "ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1",
  },
  metrics: {
    cpu_usage: "top -l 1 -n 0 2>/dev/null | grep 'CPU usage' | awk '{print $3}' | sed 's/%//' || echo 0",
    memory: "vm_stat 2>/dev/null | awk -v page=$(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1073741824}') '/^Pages active/ {a=$3} /^Pages wired/ {w=$3} END {page_size=16384; t=page; u=(a+w)*page_size/1073741824; p=t>0?u/t*100:0; printf \"%.1f %.1f %.1f\", t, u, p}' || echo '0 0 0'",
    disk: "df -m / 2>/dev/null | tail -1 | awk '{print $2/1024, $3/1024, substr($5,1,length($5)-1)}'",
    network: "netstat -ib 2>/dev/null | grep -v lo0 | awk 'NR>1 {rx+=$7; tx+=$10} END {printf \"%.2f %.2f\", rx/1048576, tx/1048576}' || echo '0 0'",
    load: "sysctl -n vm.loadavg 2>/dev/null | awk '{print $2, $3, $4}' || uptime | awk -F'load averages:' '{print $2}'",
    uptime: "sysctl -n kern.boottime 2>/dev/null | awk -F'[= ,]' '{print $4}' | xargs -I{} sh -c 'echo $(($(date +%s)-{}))' || echo 0",
  },
  compliance: {
    cpu: 'top -l 1 -n 0 | head -10',
    memory: 'vm_stat && sysctl hw.memsize',
    disk: 'df -h && du -sh /* 2>/dev/null | sort -rh | head -20',
    network: 'ifconfig && networksetup -listallhardwareports 2>/dev/null | head -30',
    users: 'dscl . list /Users | grep -v "^_" | head -30',
    services: 'launchctl list 2>/dev/null | grep -v "com.apple" | head -30',
    uptime: 'uptime && who',
    os_info: 'sw_vers && uname -a',
  },
  security: {
    listening_ports: 'lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | head -30 || netstat -an -f inet | grep LISTEN | head -20',
    open_files: 'sysctl -n kern.maxfiles kern.num_files 2>/dev/null || ulimit -n 2>/dev/null || echo 0',
    failed_logins: 'log show --predicate \'eventMessage contains "Failed to login"\' --last 1h 2>/dev/null | head -20 || last 2>/dev/null | head -20',
    root_ssh_keys: 'cat /var/root/.ssh/authorized_keys 2>/dev/null | head -5 || cat /root/.ssh/authorized_keys 2>/dev/null | head -5 || echo ""',
    world_writable_files: "find / -maxdepth 3 -type f -perm -0002 2>/dev/null | head -20 || echo ''",
    firewall_status: '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "unknown"',
    selinux_status: 'echo "N/A on macOS"',
  },
};

// ── Solaris ──
const SolarisTemplates: CommandTemplates = {
  info: {
    os: 'uname -a && cat /etc/release 2>/dev/null | head -1',
    cpu_cores: "kstat cpu_info 2>/dev/null | grep -c 'chip_id' || psrinfo 2>/dev/null | wc -l || echo 0",
    memory_gb: "prtconf -m 2>/dev/null | awk '{printf \"%.1f\", $NF/1024}' || echo 0",
    disk_gb: "df -bG 2>/dev/null | awk '/^\\//{sum+=$2}END{print int(sum)}' || echo 0",
    ip_address: "ifconfig -a 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1",
  },
  metrics: {
    cpu_usage: "mpstat 2>/dev/null | tail -1 | awk '{print 100 - $NF}' || echo 0",
    memory: "prstat -s rss 1 1 2>/dev/null | tail -1 | awk '{printf \"%.1f %.1f %.1f\", 0, 0, 0}' || echo '0 0 0'",
    disk: "df -b / 2>/dev/null | tail -1 | awk '{printf \"%.1f %.1f %.0f\", $2/1073741824, $3/1073741824, $4/$2*100}' || echo '0 0 0'",
    network: "netstat -I 2>/dev/null | tail -1 | awk '{printf \"%.2f %.2f\", $4/1048576, $5/1048576}' || echo '0 0'",
    load: "uptime 2>/dev/null | awk -F'load averages:' '{print $2}' | xargs || echo '0 0 0'",
    uptime: "kstat -p unix:0:system_misc:boot_time 2>/dev/null | awk '{print $2}' | xargs -I{} sh -c 'echo $(($(date +%s)-{}))' || echo 0",
  },
  compliance: {
    cpu: 'mpstat 2>/dev/null | head -20',
    memory: 'prstat -s rss 1 3 2>/dev/null | head -20',
    disk: 'df -h && du -sh /var /opt 2>/dev/null | sort -rh',
    network: 'ifconfig -a && netstat -rn',
    users: 'cat /etc/passwd | cut -d: -f1,3,6,7',
    services: 'svcs -a 2>/dev/null | head -30',
    uptime: 'uptime && who',
    os_info: 'uname -a && cat /etc/release',
  },
  security: {
    listening_ports: 'netstat -an -f inet 2>/dev/null | grep LISTEN | head -20 || echo "unavailable"',
    open_files: 'ulimit -n 2>/dev/null || echo 0',
    failed_logins: 'lastb 2>/dev/null | head -20 || echo "no data"',
    root_ssh_keys: 'cat /root/.ssh/authorized_keys 2>/dev/null | head -5 || echo ""',
    world_writable_files: "find / -maxdepth 3 -type f -perm -0002 2>/dev/null | head -20 || echo ''",
    firewall_status: 'ipf -V 2>/dev/null || echo "unmanaged"',
    selinux_status: 'echo "N/A on Solaris"',
  },
};

// ── AIX ──
const AixTemplates: CommandTemplates = {
  info: {
    os: 'oslevel -s 2>/dev/null || uname -a',
    cpu_cores: "lscfg -vp | grep -c '#.*Processor' 2>/dev/null || bindprocessor -q 2>/dev/null | wc -l || echo 0",
    memory_gb: "lsdev -Cc memory 2>/dev/null | awk 'NR>1{sum+=$NF}END{printf \"%.1f\", sum/1024}' || bootinfo -r 2>/dev/null | awk '{printf \"%.1f\", $1/1048576}' || echo 0",
    disk_gb: "df -g 2>/dev/null | awk '/^\\//{sum+=$2}END{print int(sum)}' || echo 0",
    ip_address: "ifconfig -a 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1",
  },
  metrics: {
    cpu_usage: "vmstat 1 2 2>/dev/null | tail -1 | awk '{print 100 - $NF}' || echo 0",
    memory: "svmon -G 2>/dev/null | tail -1 | awk '{printf \"%.1f %.1f %.1f\", $2/1024, $3/1024, ($2>0?$3/$2*100:0)}' || echo '0 0 0'",
    disk: "df -m / 2>/dev/null | tail -1 | awk '{print $2/1024, $3/1024, $5}'",
    network: "netstat -i 2>/dev/null | tail -1 | awk '{printf \"%.2f %.2f\", $5/1048576, $8/1048576}' || echo '0 0'",
    load: "uptime 2>/dev/null | awk -F'load average' '{print $2}' | tr -d ':' | xargs || echo '0 0 0'",
    uptime: "bootinfo -b 2>/dev/null | head -1 && uptime 2>/dev/null | awk '{print $3}' || echo 0",
  },
  compliance: {
    cpu: 'vmstat 1 3 | head -15',
    memory: 'svmon -G && lsdev -Cc memory',
    disk: 'df -g && du -sh /var /opt /usr 2>/dev/null | sort -rh',
    network: 'ifconfig -a && netstat -rn',
    users: 'cat /etc/passwd | cut -d: -f1,3,6,7',
    services: 'lssrc -a 2>/dev/null | head -30',
    uptime: 'uptime && who',
    os_info: 'oslevel -s && uname -a',
  },
  security: {
    listening_ports: 'netstat -an -f inet 2>/dev/null | grep LISTEN | head -20',
    open_files: 'ulimit -n 2>/dev/null || echo 0',
    failed_logins: '/usr/sbin/last -25 2>/dev/null | head -20 || echo "no data"',
    root_ssh_keys: 'cat /.ssh/authorized_keys 2>/dev/null | head -5 || echo ""',
    world_writable_files: "find / -maxdepth 3 -type f -perm -0002 2>/dev/null | head -20 || echo ''",
    firewall_status: 'lssrc -t ipsec 2>/dev/null || echo "unmanaged"',
    selinux_status: 'echo "N/A on AIX"',
  },
};

// ================================================================
// Template lookup
// ================================================================

const templateRegistry: Record<OSType, CommandTemplates> = {
  linux: LinuxTemplates,
  windows: WindowsTemplates,
  freebsd: FreeBSDTemplates,
  macos: MacosTemplates,
  solaris: SolarisTemplates,
  aix: AixTemplates,
  unknown: LinuxTemplates, // fallback
};

export function getCommandTemplates(osType: OSType): CommandTemplates {
  return templateRegistry[osType] || LinuxTemplates;
}

// ================================================================
// OS 类型检测
// ================================================================

export function detectOSType(osOutput: string): OSType {
  const lower = osOutput.toLowerCase();

  if (lower.includes('windows') || lower.includes('microsoft')) return 'windows';
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') ||
      lower.includes('centos') || lower.includes('red hat') || lower.includes('fedora') ||
      lower.includes('suse') || lower.includes('alpine') || lower.includes('kylin')) return 'linux';
  if (lower.includes('freebsd') || lower.includes('free bsd')) return 'freebsd';
  if (lower.includes('darwin') || lower.includes('macos') || lower.includes('mac os')) return 'macos';
  if (lower.includes('solaris') || lower.includes('sunos') || lower.includes('oracle solaris')) return 'solaris';
  if (lower.includes('aix')) return 'aix';

  return 'unknown';
}
