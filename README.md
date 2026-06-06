# LeaveItThere + HomeComforts -- SPT 离线版塔科夫物品放置与据点系统

> **版本**: 适配 SPT 3.11.4 | **Author**: Jehree | **移植**: SamMeow  
> LeaveItThere Client v2.0.1 / Server v1.3.1 | HomeComforts Client v1.0.3 / Server v1.0.1  
> **许可证**: MIT

---

## 一、项目概述

由两个相互配合的 MOD 组成：

| MOD | 核心功能 | 技术栈 |
|-----|---------|--------|
| **LeaveItThere** | 物品放置引擎：捡起物品放入世界，跨局持久化，可移动/旋转/物理化 | C# BepInEx 客户端 + TypeScript 服务端 |
| **HomeComforts** | 据点建设扩展：安全屋无线电（自定义撤离点 + 重生点）+ 暖炉（舒适 Buff） | C# BepInEx 客户端 + TypeScript 服务端 |

**依赖关系**：HomeComforts 硬依赖 LeaveItThere >= 2.0.1。HomeComforts 是 LeaveItThere 的 addon mod，利用其 Addon API 扩展功能性物品。

---

## 二、项目结构

### LeaveItThere 子系统

```
LeaveItThere-For3114/
├── LeaveItThere-Core/                C# 客户端插件 (BepInEx, .NET Framework 4.7.1)
│   ├── Plugin.cs                     入口：注册补丁、Fika检测、可放置物品过滤器初始化
│   ├── Components/                   
│   │   ├── LITSession.cs             单局会话（点数字典、FakeItem管理、AddonData全局存储、物品生成）
│   │   ├── FakeItem.cs               已放置物品的"替身"（交互菜单、NavMeshObstacle、碰撞控制）
│   │   ├── ItemMover.cs              移动/旋转/物理编辑模式（Move Mode）
│   │   └── Moveable.cs               Rigidbody 物理休眠/唤醒控制
│   ├── Patches/
│   │   ├── EarlyGameStartedPatch.cs  开局时创建 LITSession
│   │   ├── GetAvailableActionsPatch.cs   所有地上物品注入 "Place Item" + 白名单/黑名单过滤
│   │   ├── GameEndedPatch.cs         局末触发事件、移除保险赔付、上传数据、销毁FakeItem
│   │   ├── InteractionsChangedHandlerPatch.cs  移动模式下阻止原生交互
│   │   └── LootExperiencePatch.cs    防止加载已放置物品时刷经验
│   ├── Helpers/                      工具类
│   │   ├── LITUtils.cs               通用工具（ServerRoute、GetAllDescendants、方向计算）
│   │   ├── ItemHelper.cs             物品序列化/反序列化/异步生成/容器操作
│   │   ├── InteractionHelper.cs      提示通知、相机锁定、输入控制
│   │   ├── Settings.cs               BepInEx 配置（~50项，6组分类）
│   │   ├── CursorHelper.cs           光标控制补丁
│   │   └── BundleThings.cs           AssetBundle 加载
│   ├── Addon/                        扩展 API（公开接口）
│   │   ├── LITStaticEvents.cs        静态事件系统（OnFakeItemInitialized、OnRaidEnd 等7个事件）
│   │   ├── LITPacketRegistration.cs  泛型 Fika 网络包注册系统
│   │   ├── LITFikaTools.cs           对外暴露的 Fika 工具（IAmHost、GetRaidId）
│   │   └── AddonToolsExamples.cs     API 使用示例文档
│   ├── Common/                       数据模型与交互抽象
│   │   ├── CustomInteraction.cs      自定义交互抽象基类（支持启用/禁用/自动刷新/TargetName）
│   │   ├── PlacedItemData.cs         已放置物品的序列化数据结构
│   │   ├── ItemFilter.cs             白名单/黑名单过滤器
│   │   └── ConsoleCommands.cs        控制台命令（reclaim_all、tp_all_items_to_player、list）
│   ├── Fika/FikaBridge.cs            Fika联机桥接层（事件代理模式，internal）
│   └── CustomUI/                     AssetBundle 弹出式编辑界面
│
├── LeaveItThere-FikaModule/           Fika 联机数据同步模块 (.NET Framework 4.7.1)
│   ├── Main.cs                       通过反射被 Core 加载
│   ├── Common/FikaMethods.cs         订阅 FikaBridge 事件
│   ├── Common/GenericPacketTools.cs  泛型包注册/发送/接收
│   └── Packets/                      自定义网络包
│
├── LeaveItThere-Server/               TypeScript 服务端 (SPT 3.11 标准)
│   ├── src/mod.ts                    主入口：两个 HTTP 路由 + 数据迁移 + 备份管理
│   ├── src/mod_helper.ts             ModHelper 工具类
│   ├── config.json                   服务端配置（5项）
│   └── types/                        SPT 3.11 类型声明
│
├── ClientBundles/editplaceditemmenu.menu  Unity AssetBundle
└── UnityAssets/MoveModeUI/           编辑菜单 UI 源素材
```

### HomeComforts 子系统

```
HomeComforts-for3114/
├── HomeComforts-Core/                C# 客户端插件 (BepInEx, .NET Framework 4.7.1)
│   ├── Plugin.cs                     入口：订阅 LeaveItThere 事件，注册 Fika 包
│   ├── Components/HCSession.cs       会话管理
│   ├── Items/Safehouse/              安全屋无线电
│   │   ├── Safehouse.cs              激活/停用/交互/Fika同步包
│   │   ├── SafehouseSession.cs       全局管理（安全屋列表、撤离/重生逻辑）
│   │   ├── SafehouseExfil.cs         自定义撤离点（继承 ExfiltrationPoint）
│   │   └── SafehouseAddonData.cs     持久化数据
│   ├── Items/SpaceHeater/            "布鲁斯的暖炉"
│   │   ├── SpaceHeater.cs            球型触发区 + 开关交互
│   │   ├── SpaceHeaterSession.cs     暖炉区追踪
│   │   ├── SpaceHeaterAddonData.cs   持久化
│   │   └── NeedsRateReductions.cs    体力/水分Buff协程
│   ├── Helpers/Settings.cs           配置（安全屋数量、暖炉Buff值等）
│   └── Patches/InitAllExfiltrationPointsPatch.cs  撤离点注入补丁
│
├── HomeComforts-Packets/             Fika 网络包定义
├── HomeComforts-Server/              TypeScript 服务端
│   ├── src/mod.ts                    物品注册 + 商人上架 + 撤离点列表路由
│   └── db/simple_item_db.json        物品模板
│
└── UnityAssets/SpaceHeater/          暖炉 Unity 预制体素材
```

---

## 三、核心运转逻辑

### 3.1 LeaveItThere — 物品放置引擎

#### 3.1.1 生命周期总览

```
┌──────────────────────────────────────────────────────┐
│                    开局 → 局中 → 局末                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  EarlyGameStartedPatch                               │
│    ↓                                                 │
│  LITSession.CreateNewModSession()                    │
│    ↓                                                 │
│  LITSession.Awake()                                  │
│    ├→ 获取 GameWorld / Player / GamePlayerOwner       │
│    ├→ HTTP POST → /jehree/pip/data_to_client         │
│    │  接收 PlacedItemDataPack（含 ItemTemplates       │
│    │  和 GlobalAddonData）                            │
│    └→ SpawnAllPlacedItems()                          │
│        ├→ 对每个 PlacedItemData:                      │
│        │   1. ItemHelper.SpawnItem() 异步生成LootItem │
│        │   2. 如果是 SearchableItem → 全部预搜寻      │
│        │   3. FakeItem.CreateNewFakeItem()            │
│        │      ├→ 克隆原物品 GameObject                 │
│        │      ├→ 移除 ObservedLootItem 组件            │
│        │      ├→ 着色（粉色，可配置）                   │
│        │      ├→ 缩小至 0.99x（视觉差异标记）           │
│        │      ├→ 添加 NavMeshObstacle                  │
│        │      ├→ 初始化交互菜单                         │
│        │      ├→ 恢复 AddonData                        │
│        │      └→ 触发 LITStaticEvents                  │
│        │   4. PlaceAtPosition() 设置位置              │
│        └→ 全部生成完成后触发 OnLastPlacedItemSpawned   │
│                                                      │
│  ——— 局中交互见 3.1.2 ———                             │
│                                                      │
│  GameEndedPatch (Prefix)                             │
│    ├→ LITStaticEvents.InvokeOnRaidEnd()             │
│    ├→ 移除已放置物品的保险赔付                          │
│    ├→ 如果是 Host：HTTP POST → /jehree/pip/data_to_server │
│    │  发送 PlacedItemDataPack（含所有 FakeItem 数据）  │
│    └→ DestroyAllFakeItems()                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 3.1.2 局中交互

**放置物品**：

```
玩家瞄准地上的 LootItem → 交互菜单出现 "Place Item"
    ↓ F 键
1. FakeItem.CreateNewFakeItem() 创建替身
2. PlaceAtLootItem():
   - 替身留在原位置（可调色调）
   - 原始 LootItem 移到 (0, -99999, 0) 地下
   - 从 PointsSpent 扣点
3. 通知玩家 + 播放音效
4. Fika: 发送 PlacedStateChangedPacket(isPlaced=true)
```

**FakeItem 交互菜单**：

每个 FakeItem 自带交互菜单，使用 `CustomInteraction` 抽象类构建：

| 交互 | 类 | 条件 |
|------|------|------|
| **Search** | `FakeItem.SearchInteraction` | 仅容器类物品 |
| **Move** | `ItemMover.EnterMoveModeInteraction` | Flags.MoveModeDisabled=false 且（包里有空间 或 配置关闭该限制） |
| **Reclaim** | `FakeItem.ReclaimInteraction` | Flags.ReclaimInteractionDisabled=false |

Addon 开发者可通过 `fakeItem.Interactions.Add(...)` 注入更多交互。

**Move Mode 编辑模式**：

| 标签页 | 操作方式 | 技术细节 |
|--------|---------|---------|
| Position | LMB 水平拖拽 / LMB+RLMB 旋转视角保持位置 / 滚轮远近 | 支持相对玩家/物品自身/世界空间；LMB+RLMB 时物品挂载到 CameraContainer |
| Rotation | 鼠标拖拽旋转 / 滚轮 Z 轴旋转 | X/Y/Z 轴可锁定；空间选项同上 |
| Physics | LMB 按下时启用 Rigidbody（可碰撞掉落），松开时禁用 | 通过 Moveable 组件控制；支持自动休眠检测 |

快捷键：F=保存, ESC=取消, 1/2/3=切换标签, X=精确模式（减速至 PrecisionMultiplier 倍）

#### 3.1.3 点数系统

- 物品费用 = 容器类的内部格子数 OR 外部物品的宽x高
- 每图独立配额（Customs 280, Factory 160, Streets 320 等，可配置）
- `Settings.MinimumPlacementCost` = 最小费用（默认3）
- `LITSession.CostOverrides` 字典支持按 TemplateId 覆盖费用
- 放置扣点，回收退点

#### 3.1.4 可放置物品过滤器（ItemFilter）

新增功能：`placeable_item_filter.json`（自动生成在 BepInEx/plugins/LeaveItThere/）

```json
{
  "WhitelistEnabled": false,
  "BlacklistEnabled": false,
  "Whitelist": [],
  "Blacklist": []
}
```

- `WhitelistEnabled=true`：只有白名单中的物品可放置
- `BlacklistEnabled=true`：黑名单中的物品不可放置
- 两者可同时启用（白名单优先？实际上是两者都检查）

#### 3.1.5 数据持久化

**服务端存储**：`user/profiles/LeaveItThere-ItemData/{profileId}/{map}.json`

如果 `global_item_data_profile=true`，profileId 替换为 "global"。

数据格式（`PlacedItemDataPack`）：
```json
{
  "ProfileId": "pmc123",
  "MapId": "bigmap",
  "ItemTemplates": [
    {
      "Location": { "x": 12.3, "y": 0.5, "z": -8.1 },
      "Rotation": { "x": 0, "y": 0.707, "z": 0, "w": 0.707 },
      "_itemDataBase64": "base64编码的物品序列化数据",
      "AddonData": { "Jehree.HomeComforts": { ... } }
    }
  ],
  "GlobalAddonData": { "Jehree.HomeComforts": { ... } }
}
```

**备份系统**：每次保存前自动备份到 `backups/{时间戳}/`，最多保留 `max_profile_backup_count` 份（默认30份）。

**数据迁移**：服务端在 `/client/game/start` 路由上注册了一个迁移处理器，自动将旧版 `item_data/` 文件夹中的数据迁移到新的按 ProfileId 组织的目录结构。

#### 3.1.6 服务端配置

```json
{
  "max_profile_backup_count": 30,
  "remove_in_raid_restrictions": true,
  "everything_is_discardable": true,
  "remove_backpack_restrictions": true,
  "global_item_data_profile": false
}
```

- `remove_in_raid_restrictions`: 清空 `RestrictionsInRaid` 数组
- `everything_is_discardable`: 所有物品 `DiscardLimit = -1`
- `remove_backpack_restrictions`: 所有背包 Grid 的过滤器重置为允许所有物品
- `global_item_data_profile`: 跨档案共享放置数据

#### 3.1.7 Fika 联机支持

**FikaBridge**（internal static class）：事件代理模式，Core 不直接依赖 Fika。

FikaModule 加载流程：
```
Plugin.Awake() → FikaInstalled? → Assembly.Load("LeaveItThere-FikaModule")
    → 反射调用 Main.Init() → 订阅 FikaBridge.xxxEmitted 事件
```

**网络包类型**：
1. `SendPlacedStateChangedPacket` — 物品放置/回收/移动
2. `SendSpawnItemPacket` — 跨客户端生成物品
3. `LITPacketRegistration` 泛型包 — 第三方 addon 使用

**LITPacketRegistration** 抽象基类：
```csharp
public abstract class LITPacketRegistration {
    public void Register();           // 注册包
    public void SendData(object data); // 发送 JSON 数据
    public abstract void OnPacketReceived(Packet packet); // 接收回调
    public virtual EPacketDestination Destination; // Everyone / HostOnly / EveryoneExceptSender
}
```

#### 3.1.8 Addon 扩展 API

LeaveItThere 提供了一套完整的第三方 mod 开发 API：

| API | 访问级别 | 说明 |
|-----|---------|------|
| `LITStaticEvents` | public static class | 7 个静态事件（OnFakeItemInitialized 等） |
| `LITSession` | public class (Singleton) | 当前局中所有物品的访问入口 |
| `LITSession.Instance.FakeItems` | public Dictionary | 所有已放置物品的字典 |
| `LITSession.Instance.GlobalAddonData` | public Dictionary | 全局数据存储 |
| `FakeItem.Interactions` | public List | 每个物品的自定义交互列表 |
| `FakeItem.AddonData` | public Dictionary | 每个物品的自定义数据 |
| `FakeItem.Flags` | public AddonFlags | 控制 MoveMode、Reclaim、碰撞等行为 |
| `FakeItem.OnSpawned` | public event | 物品跨局恢复时触发 |
| `FakeItem.OnPlacedStateChanged` | public event | 物品被放置/回收时触发 |
| `LITPacketRegistration` | public abstract class | Fika 网络包系统 |
| `LITFikaTools` | public static class | IAmHost()、GetRaidId() |
| `LITUtils` | public class | ServerRoute()、GetAllDescendants() 等 |
| `CustomInteraction` | public abstract class | 自定义交互基类 |
| `ItemHelper` | public static class | 物品生成/序列化/容器操作 |
| `FakeItem.AddonFlags` | public class（嵌套） | MoveModeDisabled、ReclaimInteractionDisabled、IsPhysicalRegardlessOfSize、RemoveRootCollider |

### 3.2 HomeComforts — 据点建设扩展

HomeComforts 利用 LeaveItThere 的 `OnFakeItemInitialized` 事件，在特定 TemplateId 的 FakeItem 上附加行为组件。

#### 3.2.1 安全屋无线电

**物品**：Safehouse Radio（`67893431dcad180324ddcc1d`，Jaeger 24500RUB）

**流程**：
```
FakeItem 初始化 → LITStaticEvents.OnFakeItemInitialized 触发
    ↓ 匹配 TemplateId
Safehouse.OnFakeItemInitialized()
    ├→ 模型放大 2x
    ├→ 添加 Safehouse 组件
    ├→ 注入交互："Activate/Disable Safehouse"、"Extract/Stop Extracting"
    └→ 注册到 SafehouseSession
        ↓ 玩家交互 "Activate Safehouse"
    SafehouseEnabled = true
        ├→ 禁止 Move / Reclaim（通过 FakeItem.Flags）
        ├→ AddonData 记录 ProfileId
        └→ Fika: 发送 SafehouseEnabledStatePacket(HostOnly)
            ↓ 玩家交互 "Extract"
    SafehouseExfil.SetCustomExfilEnabled(true)
        ├→ 在当前玩家位置放置自定义撤离点
        ├→ 7秒个体撤离倒计时
        └→ 撤离点 EntryPoints = 全局所有进入点
            ↓ 撤离成功 (exitName = "homecomforts_safehouse")
    SafehouseGlobalAddonData.AddProfile()
        ├→ 记录：ProfileId + InfilPosition + SafehouseId
        └→ Fika: 发送 SafehouseProfileDataToHostPacket
            ↓ 下一局开局
    OnLastPlacedItemSpawned()
        └→ 检查 SafehouseGlobalAddonData.ContainsProfile()
            ├→ 找到对应的安全屋
            └→ player.Teleport(infilPosition)  // 重生在安全屋位置
```

**配置**：
- `Always Infil at Safehouse`：总是从上次安全屋重生（否则只在从安全屋撤离后的下一局重生）
- `Player Scavs can use Safehouse`：Scav 模式可用
- `Exfil Area Size Multiplier`：撤离触发区大小
- 每图安全屋数量上限（默认1）

#### 3.2.2 布鲁斯的暖炉

**物品**：Bruce's Space Heater（`67893bbeafe8250ed0fe6770`，Jaeger 48500RUB）

**流程**：
```
FakeItem 初始化 → SpaceHeater.OnFakeItemInitialized()
    ├→ CreatePrimitive(Sphere) 创建球型触发区
    ├→ 设为 "Triggers" layer + LITKeepLayer 防碰撞修改
    ├→ scale = SpaceHeaterAOESizeMultiplier（默认14倍）
    ├→ 添加交互 "Turn On/Off"
    ├→ 注册到 SpaceHeaterSession
    └→ 从 AddonData 恢复上次开关状态
        ↓ 玩家进入触发区（OnTriggerEnter，IPhysicsTrigger接口）
    NeedsRateReductions.SetEnabled(true)
        ├→ UI 显示：HydrationRate += 3.5, EnergyRate += 3.5（视觉）
        └→ 协程：每15秒实际恢复 3.5/4 = 0.875
        ↓ 玩家离开触发区（OnTriggerExit）
    NeedsRateReductions.SetEnabled(false)
        ├→ UI 恢复原始速率
        └→ KillCoroutine
```

**设计思想**：
- Buff 值除以 4（15秒 Tick）是为了让频繁进出温暖区的玩家也能获得部分收益
- 如果玩家在多个暖炉的重叠区域中，只生效一个 Buff（通过 SpaceHeaterSession.PlayerIsInSpaceHeaterZone 计数控制）

**配置**：
- `Space Heater AOE Size Multiplier`：温暖区大小（需重启突袭生效，默认14）
- `Hydration/Energy Buff`：每分钟恢复值（默认3.5）

---

## 四、版本状态：已适配 SPT 3.11.4

| 组件 | 状态 | 说明 |
|------|------|------|
| LeaveItThere 客户端 (C#) | **兼容** | .NET Framework 4.7.1，引用本地 SPT 3.11 EFT 程序集 |
| LeaveItThere 服务端 (TypeScript) | **兼容** | `sptVersion: ~3.11`，标准 SPT mod 结构 |
| HomeComforts 客户端 (C#) | **兼容** | Hard 依赖 LeaveItThere >= 2.0.1 |
| HomeComforts 服务端 (TypeScript) | **兼容** | `sptVersion: ~3.11` |

**HomeComforts 对 LeaveItThere API 的依赖已验证**：

| HomeComforts 使用的 API | LeaveItThere 中的存在 | 访问级别 |
|--------------------------|---------------------|---------|
| `LITStaticEvents.OnFakeItemInitialized` | `public static event` | OK |
| `LITStaticEvents.OnLastPlacedItemSpawned` | `public static event` | OK |
| `LITStaticEvents.OnRaidEnd` | `public static event` | OK |
| `LITSession.Instance` | `public static` singleton | OK |
| `LITSession.Instance.GetGlobalAddonDataOrNull()` | `public` method | OK |
| `LITSession.Instance.PutGlobalAddonData()` | `public` method | OK |
| `LITUtils.ServerRoute()` | `public static` method | OK |
| `LITPacketRegistration` | `public abstract class` | OK |
| `LITFikaTools.IAmHost()` | `public static` method | OK |
| `FakeItem.Interactions` | `public List` | OK |
| `FakeItem.AddonData` | `public Dictionary` | OK |
| `FakeItem.Flags` | `public AddonFlags` | OK |
| `FakeItem.OnSpawned` | `public event` | OK |
| `FakeItem.OnPlacedStateChanged` | `public event` | OK |
| `CustomInteraction` | `public abstract class` | OK |
| `ItemHelper` | `public static class` | OK |

---

## 五、控制台命令（`~` 打开）

| 命令 | 说明 |
|------|------|
| `reclaim_all` | 回收当前地图所有已放置物品到背包 |
| `tp_all_items_to_player` | 传送所有已放置物品到玩家前方 |
| `list` | 列出当前地图所有已放置物品 |

---

## 六、安装

1. 编译 `LeaveItThere-Core` → 放入 `BepInEx/plugins/LeaveItThere/`
2. 放入 `ClientBundles/editplaceditemmenu.menu` 到同一目录
3. `LeaveItThere-Server` 放入 `user/mods/LeaveItThere-Server/`（`npm run build` 编译）
4. `HomeComforts-Core` + `HomeComforts-Packets` → 放入 `BepInEx/plugins/HomeComforts/`
5. `HomeComforts-Server` 放入 `user/mods/`（`npm run build` 编译）
6. （可选）Fika 联机：同时放入 `LeaveItThere-FikaModule`

---

## 七、扩展开发快速指南

```csharp
// 在你的插件 Awake() 中订阅事件
LITStaticEvents.OnFakeItemInitialized += OnFakeItemInitialized;

void OnFakeItemInitialized(FakeItem fakeItem)
{
    // 检查物品 ID
    if (fakeItem.TemplateId != "your_item_template_id") return;

    // 添加你的行为组件
    fakeItem.gameObject.AddComponent<YourBehaviour>();

    // 添加自定义交互
    fakeItem.Interactions.Add(new YourInteraction(fakeItem));

    // 存储自定义数据（跨局持久化）
    fakeItem.PutAddonData("your_key", new YourData());
}

// 自定义交互示例
class YourInteraction(FakeItem fakeItem) : CustomInteraction(fakeItem)
{
    public override string Name => "Do Something";
    public override void OnInteract() { /* ... */ }
}
```

---

*"Preparing for the future — one placed item at a time!"*
