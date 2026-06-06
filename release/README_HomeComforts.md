# HomeComforts -- SPT 离线版塔科夫据点建设扩展

> **版本**: 适配 SPT 3.11.4 | **Author**: Jehree | **移植**: SamMeow  
> Client v1.0.4 / Server v1.0.2 | **许可证**: MIT

---

## 简介

HomeComforts 是 LeaveItThere 的扩展 addon，利用物品放置系统添加了两件功能性物品：**安全屋无线电**和**布鲁斯的暖炉**，让你在塔科夫的废土中建造属于自己的"据点"。

**硬依赖**: LeaveItThere >= 2.0.1

---

## 功能

### 安全屋无线电 (Safehouse Radio)

- **商人**: Jaeger, 24,500 RUB
- **功能**: 在突袭中放置后，可激活一个"安全屋"。在安全屋内可创建自定义撤离点（7 秒个体撤离），下一局可从撤离位置重生。
- **机制**: 激活后禁止移动/回收。撤离成功后记录撤离位置，下一局自动传送。
- **限制**: 每地图可配置安全屋数量上限（默认 1）。

### 布鲁斯的暖炉 (Bruce's Space Heater)

- **商人**: Jaeger, 48,500 RUB
- **功能**: 放置后创建球型温暖区。进入温暖区后，体力恢复 +3.5/分钟、水分恢复 +3.5/分钟（可配置）。
- **机制**: 球形触发区（大小可配置），每 15 秒 Tick 一次 Buff。可开关。
- **配置**: 温暖区大小、Buff 值均可调整。

---

## 安装

1. 编译 `HomeComforts-Core` → 放入 `BepInEx/plugins/HomeComforts/HomeComforts.dll`
2. （可选 Fika 联机）编译 `HomeComforts-Packets` → 放入 `BepInEx/plugins/HomeComforts/HomeComforts-Packets.dll`
3. `HomeComforts-Server` 放入 `user/mods/HomeComforts-Server/`（需先 `npm install && npm run build`）

---

## 配置

### 服务端 (`HomeComforts-Server/config.json`)

```json
{
    "SafehouseItemIds": ["67893431dcad180324ddcc1d"],
    "SpaceHeaterItemIds": ["67893bbeafe8250ed0fe6770"]
}
```

### 客户端 (F12 BepInEx Configuration Manager)

| 选项 | 默认 | 说明 |
|------|------|------|
| Always Infil at Safehouse | false | 是否总是从安全屋重生 |
| Player Scavs can use Safehouse | false | Scav 模式是否可用 |
| Exfil Area Size Multiplier | 8 | 撤离触发区大小 |
| Space Heater AOE Size Multiplier | 14 | 暖炉温暖区半径 |
| Hydration Buff | 3.5 | 每分钟水分恢复值 |
| Energy Buff | 3.5 | 每分钟体力恢复值 |
| 每图安全屋数量 | 1 | 各图独立配置 |

---

## 扩展开发

基于 LeaveItThere Addon API 的二次扩展示例：

```csharp
LITStaticEvents.OnFakeItemInitialized += (fakeItem) =>
{
    if (fakeItem.TemplateId != "your_item_id") return;
    fakeItem.Interactions.Add(new YourCustomInteraction(fakeItem));
};
```

---

*Vault-Tec 提醒: 你的藏身处不是避难所。但当废土的风暴来临，总比露宿街头好。*
