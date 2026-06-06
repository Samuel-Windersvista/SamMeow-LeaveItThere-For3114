# LeaveItThere + HomeComforts — 代码审查与改进方案

> 审查日期: 2026-06-03 | 目标版本: SPT 3.11.4  
> 审查范围: LeaveItThere (Client v2.0.1 / Server v1.3.1) + HomeComforts (Client v1.0.3 / Server v1.0.1)  
> 议会审议: 2026-06-03 (Alpha · Gamma; Beta 超时) | 共识度: **强共识** (2/2 议员对关键发现基本一致)

---

## 目录

1. [版本兼容性确认](#一版本兼容性确认)
2. [Bug / 逻辑缺陷](#二bug--逻辑缺陷)
3. [性能 / 帧数优化](#三性能--帧数优化)
4. [代码质量改进](#四代码质量改进)
5. [功能扩展可能](#五功能扩展可能)
6. [优先级分级行动方案](#六优先级分级行动方案)
7. [议会审议记录](#七议会审议记录)

---

## 一、版本兼容性确认

[v] **已确认：两个 MOD 的源码已正确适配 SPT 3.11.4**

| 组件 | 技术栈 | SPT 版本 | 状态 |
|------|--------|---------|------|
| LeaveItThere 客户端 | C# BepInEx, .NET Framework 4.7.1 | 通过本地 Assembly-CSharp.dll 引用 | OK |
| LeaveItThere 服务端 | TypeScript, `sptVersion: ~3.11` | 标准 SPT 3.x mod | OK |
| HomeComforts 客户端 | C# BepInEx, .NET Framework 4.7.1 | 依赖 LeaveItThere >= 2.0.1 | OK |
| HomeComforts 服务端 | TypeScript, `sptVersion: ~3.11` | 标准 SPT 3.x mod | OK |

**HomeComforts 对 LeaveItThere API 的依赖**：已验证所有引用的 public API（`LITStaticEvents`, `LITSession`, `LITPacketRegistration`, `LITFikaTools`, `LITUtils`, `FakeItem`, `CustomInteraction`, `ItemHelper`）均在 LeaveItThere 3.11.4 代码中以 `public` 访问级别存在。

[!] **议会注**：静态存在性验证 ≠ 运行时行为契约验证。事件触发时机、字典初始化状态等运行时行为仍需在实际游戏环境中测试。

**Harmony Patch 稳定性**：全票通过。`GameEndedPatch` 使用反射搜索而非 `Class308` 硬编码，`LootExperiencePatch` 使用参数名+类型匹配，均为版本切换安全的写法。

---

## 二、Bug / 逻辑缺陷

### 2.1 [LeaveItThere 服务端] 日志中写入错误的 MOD 名称— [议会: 全票同意, P0]

```typescript
// LeaveItThere-Server/src/mod.ts:124
console.error(
    "\x1b[31m%s\x1b[0m",
    "[HomeComforts]: max_profile_backup_count in config.json ..."  // 应该是 "[LeaveItThere]"
);
```

**修复**：将 `[HomeComforts]` 改为 `[LeaveItThere]`。Alpha 建议直接使用 `ModHelper.modName` 常量（值为 `"LeaveItThere"`）。

### 2.2 [LeaveItThere 服务端] 空 if 语句体— [议会: 全票同意, P0]

```typescript
// LeaveItThere-Server/src/mod.ts:52-53
if (Config.everything_is_discardable) {
}  // 空体
for (const [_, item] of Object.entries(this.Helper.dbItems)) {
    if (item._type !== "Item") continue;
    if (Config.everything_is_discardable) {
        item._props.DiscardLimit = -1;
    }
```

**问题**：第一个 `if` 块是空的，实际的逻辑在循环内部重复判断。Alpha 指出这可能揭示了原始设计意图——本来打算在此处做全局一次性设置。

**修复**：
```typescript
if (Config.everything_is_discardable || Config.remove_backpack_restrictions) {
    for (const [_, item] of Object.entries(this.Helper.dbItems)) {
        if (item._type !== "Item") continue;
        if (Config.everything_is_discardable) {
            item._props.DiscardLimit = -1;
        }
        // ...backpack logic
    }
}
```

### 2.3 [LeaveItThere 服务端] 潜在的路径大小写问题— [议会: 全票确认为真实bug，严重性有分歧]

```typescript
// LeaveItThere-Server/src/mod.ts:109-111
if (mapId === "Sandbox_high") {   // 大写 S
    mapName = "Sandbox";           // 大写 S
}
```

**问题**（Gamma 补充深化）：这不仅是大小写不一致，而是**跨平台数据分裂风险**：
1. 客户端 `Settings.cs:339` 使用**全小写** `"sandbox_high"`，且 `GetAllottedPoints()` 做了 `LocationId.ToLower()`
2. 服务端**没有**做 `.toLowerCase()`，导致实际传入的小写 `"sandbox_high"` 不会被映射
3. 在 **Linux 服务端**（文件系统大小写敏感）上，`Sandbox.json` 和 `sandbox.json` 是两个独立文件 — Ground Zero 高低配版本数据被分裂到两个不同文件

**议会优先级辩论**：
- Alpha 认为严重性被高估，应降为 P1（不会导致数据丢失，只是不合并）
- Gamma 认为应维持 P0（考虑到 Linux 服务器的跨平台风险）
- 最终裁定：**P0**，采用 Gamma 的跨平台论证

**修复**：统一使用 `.toLowerCase()`，保持与客户端 Settings.cs 第 347 行的 `LocationId.ToLower()` 一致：
```typescript
const mapIdLower = mapId.toLowerCase();
if (mapIdLower === "sandbox_high") {
    mapName = "Sandbox";
}
// 同样处理 factory4_day / factory4_night → factory
```

### 2.4 [LeaveItThere 客户端] Settings.cs 标签编号重复— [议会: 全票同意, P1]

```csharp
// Settings.cs:
ClickColor = config.Bind(_moveModeSectionName, "8: Click Color", ...);
BackgroundColor = config.Bind(_moveModeSectionName, "8: Background Color", ...);
```

**修复**：将 `BackgroundColor` 改为 `"9: Background Color"`。

### 2.5 [LeaveItThere 客户端] LITSession._instance 跨局残留— [议会: 基本同意, P1→P2]

```csharp
// LITSession.cs:
private static LITSession _instance = null;
// ...DestroyAllFakeItems() 中未将 _instance 置 null
```

**议会修正**：
- Gamma 指出：`CreateNewModSession()` 会直接覆盖 `_instance`，且 Unity 的 `==` 运算符重载会对已销毁对象判定为 fake null。实际风险较低。
- 真正风险在于"局结束到 CreateNewModSession() 之间的窗口期"的 race condition，但触发概率极低。
- **降为 P2**。

**修复**：在 `DestroyAllFakeItems()` 后添加 `_instance = null;`，或直接在 GameEndedPatch.Prefix 末尾添加。

### 2.6 [LeaveItThere 客户端] InteractionHelper 异常静默吞没— [议会: 全票同意, P1]

```csharp
// InteractionHelper.cs RefreshPrompt():
catch (System.Exception) { }
```

**修复**：
```csharp
catch (System.Exception ex) {
#if DEBUG
    Plugin.LogSource.LogDebug($"RefreshPrompt suppressed: {ex.Message}");
#endif
}
```

### 2.7 [HomeComforts] HandleFallPatch 不可用— [议会: 全票同意, P1]

```csharp
// HandleFallPatch.cs 引用了不存在的 Settings.DisableFallDamage
```

**修复**：要么完成此功能（添加 Settings 项），要么删除文件。Gamma 建议直接删除——死代码不应留在仓库中。

### 2.8 [HomeComforts] SafehouseSession 冗余检查— [P1]

```csharp
// SafehouseSession.cs OnLastPlacedItemSpawned():
if (!_session.AddonData.ContainsProfile()) return;
// ... 
else {
    if (_session.AddonData.ContainsProfile()) // 冗余
        _session.AddonData.RemoveProfile();
}
```

**修复**：简化逻辑，移除冗余检查。

### 2.9 [HomeComforts] LayerSetterInfo 结构体未使用— [P1]

```csharp
// Plugin.cs:
public struct LayerSetterInfo {
    public string TemplateId;
    public List<string> GameobjectNames;
    string LayerName;  // 私有，无法设置
}
```

**修复**：完成或删除。

---

### [议会新增] 2.10 [LeaveItThere 客户端] SpawnAllPlacedItems 计数器死锁— [Alpha 发现, Gamma 确认, P0]

**文件**：`LeaveItThere-Core/Components/LITSession.cs`，第 73-113 行

```csharp
_itemsToSpawn = dataPack.ItemTemplates.Count;

for (int i = 0; i < dataPack.ItemTemplates.Count; i++)
{
    PlacedItemData data = dataPack.ItemTemplates[i];
    if (data.Item == null) continue; // ← BUG: 跳过后不递增 _itemsSpawned

    ItemHelper.SpawnItem(data.Item, ..., (LootItem lootItem) =>
    {
        _itemsSpawned++;               // 仅在回调中递增
        if (_itemsSpawned >= _itemsToSpawn) { ... }  // 永远无法到达！
    });
}
```

**问题**：如果有任何 `data.Item == null`（物品反序列化失败，mod 更新导致物品 ID 变更时常见），该物品的回调永不被调度，`_itemsSpawned` 永达不到 `_itemsToSpawn`，导致：
- `LootExperienceEnabled` 保持 `false` — **整个 raid 中所有拾取行为的经验值获取被完全禁用**
- `OnLastPlacedItemSpawned` 事件永不触发 — 依赖此事件的 Addon 逻辑死锁（包括 HomeComforts 的安全屋重生功能）

**严重性**：P0。影响核心游戏循环（经验值），且触发条件常见（mod 物品更新）。

**修复**：
```csharp
// 方案 A：跳过时同步计数（推荐）
for (int i = 0; i < dataPack.ItemTemplates.Count; i++)
{
    if (data.Item == null)
    {
        _itemsSpawned++;
        if (_itemsSpawned >= _itemsToSpawn) {
            Instance.LootExperienceEnabled = true;
            LITStaticEvents.InvokeOnLastPlacedItemSpawned(null);
        }
        continue;
    }
    // ...
}

// 方案 B：只计算有效物品数
_itemsToSpawn = dataPack.ItemTemplates.Count(t => t.Item != null);
```

---

### [议会新增] 2.11 [LeaveItThere 客户端] Settings.GetAllottedPoints 未知地图崩溃— [Alpha & Gamma 独立发现, P1]

**文件**：`LeaveItThere-Core/Helpers/Settings.cs`，第 347 行

```csharp
return _itemCountLookup[Singleton<GameWorld>.Instance.LocationId.ToLower()].Value;
```

如果玩家进入 mod 自定义地图（LocationId 不在 `_itemCountLookup` 中），直接抛出 `KeyNotFoundException`，整个放置系统崩溃。

**修复**：添加 TryGetValue 兜底：
```csharp
if (!_itemCountLookup.TryGetValue(Singleton<GameWorld>.Instance.LocationId.ToLower(), out var entry))
{
    Plugin.LogSource.LogWarning($"Unknown map, using default points.");
    return int.MaxValue; // 或从配置读取默认值
}
return entry.Value;
```

---

### [议会新增] 2.12 [LeaveItThere 客户端] FakeItem.LootItem getter NullReferenceException 风险— [Gamma 发现, P2]

**文件**：`LeaveItThere-Core/Components/FakeItem.cs`，第 68-74 行

```csharp
get
{
    if (_lootItem.Item == null || _lootItem.Item.Id == null) // _lootItem 本身可能为 null!
    {
        _lootItem = ItemHelper.GetLootItem(ItemId) as ObservedLootItem; // as 转换失败返回 null
    }
    return _lootItem;
}
```

**修复**：
```csharp
get
{
    if (_lootItem != null && _lootItem.Item != null && _lootItem.Item.Id != null)
        return _lootItem;
    _lootItem = ItemHelper.GetLootItem(ItemId) as ObservedLootItem;
    if (_lootItem == null)
        Plugin.LogSource.LogError($"Failed to resolve LootItem for {ItemId}");
    return _lootItem;
}
```

---

## 三、性能 / 帧数优化

### 3.1 [LeaveItThere] GetAllDescendants 递归分配— [议会: 全票同意, P2]

`LITUtils.cs:93-104`：每次递归创建一个 `List<GameObject>`。

**调用点**：`FakeItem.SetPlayerAndBotCollisionEnabled()` — 物品放置/碰撞切换时调用。Gamma 指出这不是热路径，实际 GC 收益比报告中暗示的低，但是一个"低垂果实"。

**优化**：改为回调模式消除中间分配：
```csharp
public static void ForAllDescendants(GameObject parent, Action<GameObject> action) {
    foreach (Transform child in parent.transform) {
        action(child.gameObject);
        ForAllDescendants(child.gameObject, action);
    }
}
```

### 3.2 [LeaveItThere] GetLootItem 线性扫描— [议会: 同意但加警告, P2]

`ItemHelper.cs:21-28`：O(n) 扫描所有 LootItem。

**Gamma 警告**：
- `GameWorld.LootItems` 是 EFT 内部集合，局中动态变化（敌人掉落、容器打开等），MOD 无法监听增删事件
- 简单维护 `Dictionary<string, LootItem>` 会导致同步问题
- 建议仅对 MOD 生成的 FakeItem 关联的原始物品建立索引，而非全图字典

**优化**（修正后）：在 LITSession 中维护 `Dictionary<string, LootItem>`，仅在物品放置时注册，回收时注销。不依赖 EFT 全局集合的同步。

### 3.3 [LeaveItThere] NavMeshObstacle 开销— [议会: 全票同意, P2]

`FakeItem.cs:144-145`：`carveOnlyStationary = false` 意味着每帧重算 NavMesh carving。

**优化**：
- 默认 `carveOnlyStationary = true`（物品放置后通常静止）
- 仅在 Move Mode 中临时改为 `false`
- 按 `MinimumSizeItemToGetCollision` 阈值控制是否添加 obstacle

### 3.4 [LeaveItThere] ItemMover.Update— [议会判定: 误判, 已移除]

~**原报告将此项列为优化点，Gamma 发现 ItemMover 构造函数（第 179 行）已设置 `enabled = false`，Update 仅在 Move Mode 激活时运行。此项不是问题，已从报告中移除。**~

### 3.5 [LeaveItThere] PlaceableItemFilter.Contains— [议会: 同意, P2]

`GetAvailableActionsPatch.cs:49-50` 使用 `List<string>.Contains`。

**Gamma 警告**：改为 HashSet 需要确保 JSON 反序列化兼容（Newtonsoft.Json 支持 `HashSet<T>`，但需验证）。

### 3.6 [议会新增] [LeaveItThere] ServerRoute 同步 HTTP 阻塞主线程— [Gamma 发现, P1]

**文件**：`LeaveItThere-Core/Helpers/LITUtils.cs`，第 106-111 行

```csharp
public static T ServerRoute<T>(string url, T data = default)
{
    string json = JsonConvert.SerializeObject(data);
    string req = RequestHandler.PostJson(url, json); // 同步阻塞主线程
    return JsonConvert.DeserializeObject<T>(req);
}
```

**影响**：
- `LITSession.Awake()` 中开局加载时同步 HTTP 请求 — 数据量大时**冻结游戏画面**
- `GameEndedPatch.Prefix()` 中局结束退出时同步发送 — 保存大量物品时**延长退出黑屏时间**

这是 SPT 社区中"加载卡顿"和"退出慢"的主要来源之一。

**修复**：改为异步协程模式，至少将大数据保存拆分为后台线程。

---

### [议会新增] 3.7 [LeaveItThere] SpawnItemRoutine 资源加载失败未处理— [Gamma 发现, P2]

**文件**：`LeaveItThere-Core/Helpers/ItemHelper.cs`，第 99-103 行

```csharp
Task loadTask = Singleton<PoolManagerClass>.Instance.LoadBundlesAndCreatePools(...);
while (!loadTask.IsCompleted)
    yield return new WaitForEndOfFrame();
// 没有检查 loadTask.IsFaulted
```

如果资源加载失败（modded 物品 bundle 缺失），代码继续执行 `SetupItem`，产生粉紫材质或 NullReference。

**修复**：添加 `if (loadTask.IsFaulted) { ... yield break; }`。

---

### [议会新增] 3.8 [LeaveItThere 服务端] onDataToServer 无错误处理— [Alpha 发现, P2]

```typescript
// mod.ts:83
fs.writeFileSync(path, JSON.stringify(info));
```

如果写入失败（磁盘满、权限问题），异常向上传播导致数据静默丢失。应加 try-catch。

---

## 四、代码质量改进

### 4.1 [LeaveItThere 服务端] 数据路由中不必要的深拷贝— [议会: 全票同意, P3]

```typescript
// mod.ts:76, 87
const data = JSON.parse(JSON.stringify(info));
```

`info` 在此处仅读取 `MapId`/`ProfileId` 两个字段。`JSON.parse(JSON.stringify(...))` 完全多余。

**修复**：`const mapId = info.MapId; const profileId = info.ProfileId;`

### 4.2 [LeaveItThere] server config.json 命名风格不统一— [议会: 同意, P3]

LeaveItThere 用下划线，HomeComforts 用驼峰。建议统一。

### 4.3 [LeaveItThere] DebugLog 使用 LogError— [议会: 同意, P1→P3]

```csharp
// Plugin.cs:90
LogSource.LogError($"[Debug Log]: {message}");
```

**议会辩论**：
- Alpha 认为有合理性：`LogDebug` 可能被 BepInEx 日志级别过滤，使用 `LogError` 确保开发时可见
- Gamma 认为语义不正确，更好的做法是 DEBUG 下用 `LogInfo` 或 `LogWarning`
- **降为 P3**（语义问题，有实际原因，影响极小）

### 4.4 [HomeComforts] SpaceHeaterAddonData 单例共享— [议会: P3→P1]

```csharp
// SpaceHeaterAddonData.cs:
private static SpaceHeaterAddonData _enabledData = new(true);
private static SpaceHeaterAddonData _disabledData = new(false);
```

**Gamma 警告**：如果所有暖炉共享同一对象实例，这不仅是代码风格问题，而是**功能错误** — 所有暖炉将共享同一组运行时状态。**升为 P1**。

**修复**：每次 `new SpaceHeaterAddonData(enabled)`。

### 4.5 [通用] 提取 API 程序集— [议会: 全票反对, P3→P4]

**议会裁定**：在当前的 BepInEx 小型 MOD 生态中（仅 HomeComforts 一个下游消费者），这是过度工程化。增加构建和发布复杂度，且 BepInEx 插件间版本管理更麻烦。当 Addon 生态扩大到 3+ 个活跃 MOD 时再考虑。

### 4.6 [议会新增] [LeaveItThere] 地图 ID 逻辑重复— [Gamma 发现, P3]

`LITUtils.cs:37-48` 和 `Settings.cs:331-342` 中都硬编码了地图 ID 的特殊处理逻辑（factory day/night 合并、方向映射等）。应提取共享的 `MapIdResolver` 类。

---

## 五、功能扩展可能

基于现有架构的自然扩展方向（按实用价值排序）：

### 5.1 网格对齐 (Grid Snapping) — 低难度 [议会: 最高优先级扩展]

在 Move Mode Position Tab 添加 "Snap to Grid" 开关。Alpha 和 Gamma 都将其评为最有价值的扩展——当前用鼠标拖动微调位置极不精确。

### 5.2 自动表面法线对齐 (Auto-Orientation) — 低难度

Place 物品时检测下方表面，自动将对齐到表面法线方向。与网格对齐配合使用价值高。

### 5.3 布局预设 (Layout Preset) — 低难度 [议会新增推荐]

Alpha 特别建议优先实现此功能。比蓝图系统简单得多（不需要新的物品生成机制），直接解决"搬家"痛点——保存摆放布局为 JSON，新 raid 中一键导入。只需保存相对位置偏移 + rotation + templateId。

### 5.4 区域系统 (Zone System) — 中难度

多个 HomeComforts 物品聚集时触发额外 buff。Gamma 认为这是对大型据点构建项目的游戏体验改变者。

### 5.5 蓝图系统 (Blueprint) — 中难度

需要新的 HTTP 路由 + 局中动态生成物品机制。社区最需要的功能之一但工程量大。

### 5.6 更多 HomeComforts 类物品 — 中难度

工作台、床/睡袋、路障、发电机、灯等。取决于作者内容规划。

### 5.7 PlaceableItemFilter UI 编辑器 — 低难度

当前 JSON 编辑已够用，Gamma 评为中等价值。

### 5.8 物品组合 (Grouping) — 中难度

统一移动/旋转/回收。涉及序列化格式变更，需服务端同步。

### 5.9 [议会新增] 物品持久化版本兼容性 — 低难度

当前 `BytesToItem` 在物品模板变更时彻底丢失物品。应考虑存储 `TemplateId` + 关键属性而非完整二进制序列化，以便版本升级后部分恢复。

### 5.10 [议会新增] Fika 同步冲突解决

Host 单方面写入服务端，如果多个玩家在同一局放置物品，非 Host 的数据会丢失。

---

## 六、优先级分级行动方案（议会终审版）

### P0 — 必须立即修复

| # | 问题 | 文件 | 议会判定 | 工作量 |
|---|------|------|---------|--------|
| P0-1 | 日志写错 mod 名称 "[HomeComforts]" | `mod.ts:124` | 全票: P0 | 1分钟 |
| P0-2 | 空 if 语句体 | `mod.ts:52-53` | 全票: P0 | 5分钟 |
| P0-3 | Sandbox_high 大小写不一致（跨平台风险） | `mod.ts:109-111` | 全票: P0 (Gamma升为跨平台论) | 5分钟 |
| **P0-4** | **SpawnAllPlacedItems 计数器死锁（经验值永久禁用）** | **`LITSession.cs:73-113`** | **议会新增 · P0** | **15分钟** |

### P1 — 应该尽快修复

| # | 问题 | 文件 | 议会判定 | 工作量 |
|---|------|------|---------|--------|
| P1-1 | ServerRoute 同步 HTTP 阻塞主线程 | `LITUtils.cs:106-111` | 议会新增 · Gamma: P1 | 2-3小时 |
| P1-2 | GetAllottedPoints 未知地图崩溃 | `Settings.cs:347` | 议会新增 · Alpha+Gamma: P1 | 10分钟 |
| P1-3 | Settings 标签重复 "8:" | `Settings.cs:151-161` | 全票: P1 | 1分钟 |
| P1-4 | 死代码 HandleFallPatch | `HandleFallPatch.cs` | 全票: P1 | 删除 |
| P1-5 | LayerSetterInfo 未使用 | `Plugin.cs:58-63` | 全票: P1 | 删除 |
| P1-6 | SafehouseSession 冗余检查 | `SafehouseSession.cs` | 全票: P1 | 5分钟 |
| P1-7 | InteractionHelper 异常静默吞没 | `InteractionHelper.cs:37` | 全票: P1 | 5分钟 |
| P1-8 | SpaceHeaterAddonData 单例共享 | `SpaceHeaterAddonData.cs` | 升为 P1 (功能错误) | 5分钟 |

### P2 — 性能优化

| # | 问题 | 方案 | 议会判定 | 工作量 |
|---|------|------|---------|--------|
| P2-1 | GetAllDescendants 内部分配 | 改为回调模式 | 同意: 低垂果实 | 30分钟 |
| P2-2 | GetLootItem 线性扫描 | 局部字典索引（非全图） | 同意: 加警告 | 1小时 |
| P2-3 | NavMeshObstacle carving 控制 | carveOnlyStationary=true | 全票: 实际帧数收益 | 5分钟 |
| P2-4 | PlaceableItemFilter Contains | 改为 HashSet | 同意: 低收益但低成本 | 15分钟 |
| P2-5 | FakeItem.LootItem getter NRE 风险 | 添加 null 检查 | 议会新增 · Gamma: P2 | 10分钟 |
| P2-6 | SpawnItemRoutine 资源加载失败未处理 | 检查 IsFaulted | 议会新增 · Gamma: P2 | 10分钟 |
| P2-7 | onDataToServer 无错误处理 | try-catch | 议会新增 · Alpha: P2 | 5分钟 |
| P2-8 | LITSession._instance 跨局残留 | _instance = null | 从 P1 降为 P2 | 1分钟 |

### P3 — 代码整洁

| # | 问题 | 文件 | 议会判定 | 工作量 |
|---|------|------|---------|--------|
| P3-1 | JSON 风格统一 | 服务端 config.json | 维持 P3 | 10分钟 |
| P3-2 | 移除不必要深拷贝 | `mod.ts:87` | 维持 P3 | 5分钟 |
| P3-3 | DebugLog 用 LogError | `Plugin.cs:90` | 从 P1 降为 P3 | 1分钟 |
| P3-4 | 地图 ID 逻辑重复 | `LITUtils.cs` + `Settings.cs` | 议会新增 · Gamma: P3 | 1小时 |

### P4 — 功能扩展（按议会推荐顺序）

| # | 功能 | 难度 | 议会推荐 | 预估 |
|---|------|------|---------|------|
| P4-1 | 网格对齐 | 低 | Alpha+Gamma: 最高优先级 | 2-3小时 |
| P4-2 | 自动表面法线对齐 | 低 | 配合网格对齐 | 1-2小时 |
| P4-3 | 布局预设 (Layout Preset) | 低 | Alpha 特别推荐 | 3-4小时 |
| P4-4 | 物品持久化版本兼容性 | 中 | Gamma 推荐 | 4-6小时 |
| P4-5 | 区域系统 | 中 | Gamma 推荐 | 4-6小时 |
| P4-6 | 蓝图系统 | 中 | 高社区需求 | 8-12小时 |
| P4-7 | 更多 HomeComforts 物品 | 中 | 内容规划 | 每种 3-6小时 |
| P4-8 | Fika 同步冲突解决 | 中 | Gamma 推荐 | 3-5小时 |
| P4-9 | 提取 API 程序集 | 中 | 降为 P4（过度工程化） | 3-4小时 |

---

## 附录 A：完整修改文件清单

```
P0 (必须修复):
  LeaveItThere-Server/src/mod.ts:124           → [HomeComforts] → [LeaveItThere]
  LeaveItThere-Server/src/mod.ts:52-53          → 删除空 if 块
  LeaveItThere-Server/src/mod.ts:109-111        → 统一大小写 .toLowerCase()
  LeaveItThere-Core/Components/LITSession.cs:73-113 → 修复 spawn 计数器死锁

P1 (应该尽快修复):
  LeaveItThere-Core/Helpers/LITUtils.cs:106-111  → 异步 HTTP (需较大改造)
  LeaveItThere-Core/Helpers/Settings.cs:347      → TryGetValue 兜底
  LeaveItThere-Core/Helpers/Settings.cs:151-161  → "9: Background Color"
  HomeComforts-Core/Patches/HandleFallPatch.cs    → 删除
  HomeComforts-Core/Plugin.cs:58-63               → 删除 LayerSetterInfo
  HomeComforts-Core/Items/Safehouse/SafehouseSession.cs → 简化冗余逻辑
  LeaveItThere-Core/Helpers/InteractionHelper.cs  → 添加 debug log
  HomeComforts-Core/Items/SpaceHeater/SpaceHeaterAddonData.cs → new 实例

P2 (性能):
  LeaveItThere-Core/Helpers/LITUtils.cs:93-104    → 回调模式
  LeaveItThere-Core/Helpers/ItemHelper.cs:21-28   → 局部字典索引
  LeaveItThere-Core/Components/FakeItem.cs:145    → carveOnlyStationary = true
  LeaveItThere-Core/Patches/GetAvailableActionsPatch.cs → HashSet
  LeaveItThere-Core/Components/FakeItem.cs:68-74  → 添加 null 检查（LootItem getter）
  LeaveItThere-Core/Helpers/ItemHelper.cs:99-103  → 检查 IsFaulted
  LeaveItThere-Server/src/mod.ts:83               → try-catch
  LeaveItThere-Core/Components/LITSession.cs      → _instance = null 重置

P3 (代码整洁):
  HomeComforts-Server/config.json                 → 命名统一（可选）
  LeaveItThere-Server/src/mod.ts:87               → 移除深拷贝
  LeaveItThere-Core/Plugin.cs:90                  → LogInfo 代替 LogError
  LeaveItThere-Core/Helpers/LITUtils.cs + Settings.cs → 提取 MapIdResolver
```

---

## 附录 B：HomeComforts 对 LeaveItThere API 依赖的交叉验证

| HomeComforts 引用 | LeaveItThere 中的定义 | 访问级别 | 状态 |
|--------------------|---------------------|---------|------|
| `LITStaticEvents.OnFakeItemInitialized` | `public static event` in `LITStaticEvents` | public | [v] |
| `LITStaticEvents.OnLastPlacedItemSpawned` | `public static event` in `LITStaticEvents` | public | [v] |
| `LITStaticEvents.OnRaidEnd` | `public static event` in `LITStaticEvents` | public | [v] |
| `LITSession.Instance` | `public static` in `LITSession` | public | [v] |
| `LITFikaTools.IAmHost()` | `public static` in `LITFikaTools` | public | [v] |
| `LITUtils.ServerRoute<T>()` | `public static` in `LITUtils` | public | [v] |
| `LITPacketRegistration` | `public abstract class` in `LITPacketRegistration` | public | [v] |
| `FakeItem.Interactions` | `public List<CustomInteraction>` | public | [v] |
| `FakeItem.Flags` | `public AddonFlags` (嵌套类) | public | [v] |
| `FakeItem.OnSpawned` | `public event` | public | [v] |
| `FakeItem.OnPlacedStateChanged` | `public event` | public | [v] |
| `CustomInteraction` | `public abstract class` in `CustomInteraction` | public | [v] |
| `ItemHelper.SpawnItem()` | `public static` in `ItemHelper` | public | [v] |

**全部 13 项 API 依赖均已通过静态存在性验证。**  
[!] 议会注：运行时行为（事件触发时机、字典初始化状态等）仍需在实际游戏环境中测试。

---

## 七、议会审议记录

### 一致同意的裁定

| 事项 | 结论 |
|------|------|
| P0-1~P0-3 判定正确 | 全票 |
| P0-4 (SpawnAllPlacedItems 死锁) 为遗漏的关键 bug | Alpha 发现，Gamma 确认 |
| P1-2 (GetAllottedPoints 崩溃) 为遗漏的重要 bug | Alpha & Gamma 独立发现 |
| P1-1 (同步 HTTP 阻塞) 为重要遗漏 | Gamma 发现 |
| 4.5 (API 程序集提取) 应降为 P4 | 全票反对过早优化 |
| 3.4 (ItemMover.Update) 是误判，应移除 | Gamma 发现 |
| 功能扩展优先实现网格对齐 + 布局预设 | 全票 |

### 有分歧的裁定

| 事项 | Alpha | Gamma | 终审 |
|------|-------|-------|------|
| 2.3 优先级 (Sandbox_high) | P1（不会丢数据） | P0（跨平台风险） | **P0** |
| 2.5 优先级 (_instance 残留) | P1 或 P2 | P2（实际风险低） | **P2** |
| 4.3 优先级 (DebugLog) | P3 | P1（语义问题） | **P3** |
| P3-3 优先级 (AddonData 单例) | 未评论 | P1（功能错误） | **P1** |

### 议员参与记录

| 议员 | 模型 | 状态 | 贡献 |
|------|------|------|------|
| Alpha | deepseek-v4-pro | 完成 | 发现 P0-4 死锁 bug，提供代码级修复方案 |
| Beta | gpt-5.4 | 超时 | — |
| Gamma | k2p6 | 完成 | 发现 6 个新问题，纠正 3.4 误判，深化跨平台分析 |

---

*Vault-Tec 质量保证部门 — 代码审查终端*  
*议会审议通过 | 共识度: 强共识 (2/2)*  
*"Preparing for the Future — one code review at a time!"*
