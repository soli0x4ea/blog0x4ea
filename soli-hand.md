
# soli-hand

USB 硬件键鼠（ESP32-S3，真实 HID 设备）。**自带 SDK 与完整说明书** ——
插上取出来就能用。不必去别处下载：取出的那份必然与固件同版本。

依赖只有一个：`pip install pyserial`

然后跑下面这段。它不依赖本项目任何代码：

```python
import glob, sys, serial

if sys.platform == 'win32':
    from serial.tools import list_ports
    ports = [p.device for p in list_ports.comports()]
else:
    ports = glob.glob('/dev/cu.usbmodem*') or glob.glob('/dev/ttyACM*')
if not ports:
    sys.exit('没找到设备串口 —— 板子插好了吗？')
s = serial.Serial(ports[0], 115200, timeout=1)

def cmd(t, p=b''):
    """发一条命令，返回 ACK 载荷。帧格式 = AA 55 | len | type | seq | payload | crc8"""
    body = bytes([len(p), t, 1]) + p
    crc = 0
    for b in body:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ 0x31) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    s.reset_input_buffer()
    s.write(b'\xAA\x55' + body + bytes([crc]))
    hdr = s.read(5)
    if len(hdr) < 5 or hdr[:2] != b'\xAA\x55':
        sys.exit(f'设备没回话：{hdr!r}')
    r = s.read(hdr[2] + 1)
    if hdr[3] == 0xF2:
        sys.exit(f'设备拒绝：err=0x{r[0]:02X}')
    return r[:hdr[2]]

i, info = 1, cmd(0x19)
for _ in range(info[0]):
    fid, nl = info[i], info[i + 1]
    name = info[i + 2:i + 2 + nl].decode()
    size = int.from_bytes(info[i + 2 + nl:i + 6 + nl], 'little')
    i += 10 + nl
    buf = b''
    while len(buf) < size:
        buf += cmd(0x1A, bytes([fid]) + len(buf).to_bytes(4, 'little'))
    open(name, 'wb').write(buf)
    print(name, len(buf))
```

落盘两个文件：

| 文件 | 是什么 |
|---|---|
| `soli_hand.py` | SDK —— 之后所有操作都用它 |
| `skill.md` | 完整说明书 —— 读完就会用 |

**读 `skill.md`，照它用。**

---

> 自动导出，勿直接编辑。权威源 `docs/skill-bootstrap.md`；重新导出跑 `tools/export-skill.sh`。
