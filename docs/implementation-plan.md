# LeaveItThere + HomeComforts — 最终实施计划

> 基于 `code-review-and-improvement-plan.md` 议会终审版 | 生成: 2026-06-03  
> 范围: P0 ~ P3（不含功能扩展）| 总预估: ~9 小时

---

## 实施概览

| 阶段 | 任务数 | 预估时间 | 依赖关系 |
|------|--------|---------|---------|
| Phase 0 (P0) | 4 | ~25分钟 | 无依赖，可并行 |
| Phase 1 (P1) | 8 | ~3.5小时 | P1-2 依赖 P0-4；其余无依赖 |
| Phase 2 (P2) | 8 | ~2.5小时 | 无依赖，可并行 |
| Phase 3 (P3) | 4 | ~1.5小时 | 无依赖，可并行 |

**建议执行顺序**：Phase 0 → Phase 1（先做 LeaveItThere 部分，再做 HomeComforts）→ Phase 2 → Phase 3

---

## Phase 0 — P0 必须立即修复 (25分钟)

4 个任务互不依赖，可并行执行。

### P0-1: 修复 mod 名称日志 (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Server/src/mod.ts` |
| 行号 | 124 |
| 风险 | 零 |

**改动**：

```diff
 console.error(
     "\x1b[31m%s\x1b[0m",
-    "[HomeComforts]: max_profile_backup_count in config.json must be a number that is 0 or greater! Fix this or auto profile backups will not work!"
+    "[LeaveItThere]: max_profile_backup_count in config.json must be a number that is 0 or greater! Fix this or auto profile backups will not work!"
 );
```

**验证**：F12 控制台不再出现来自 HomeComforts 的错误提示。

---

### P0-2: 删除空 if 语句体 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Server/src/mod.ts` |
| 行号 | 52-53 |
| 风险 | 零 |

**改动**（删除空 if 块，将条件提升到循环外层）：

```diff
-        if (Config.everything_is_discardable) {
-        }
-        for (const [_, item] of Object.entries(this.Helper.dbItems)) {
+        if (Config.everything_is_discardable || Config.remove_backpack_restrictions) {
+            for (const [_, item] of Object.entries(this.Helper.dbItems)) {
-            if (item._type !== "Item") continue;
+                if (item._type !== "Item") continue;
-            if (Config.everything_is_discardable) {
-                item._props.DiscardLimit = -1;
-            }
+                if (Config.everything_is_discardable) {
+                    item._props.DiscardLimit = -1;
+                }
-            if (Config.remove_backpack_restrictions && this.Helper.itemHelper.isOfBaseclass(item._id, BaseClasses.BACKPACK)) {
-                for (const [_, grid] of Object.entries(item._props.Grids)) {
-                    if (!grid?._props?.filters) continue;
-                    grid._props.filters = [
-                        {
-                            Filter: [BaseClasses.ITEM],
-                            ExcludedFilter: [],
-                        },
-                    ];
+                if (Config.remove_backpack_restrictions && this.Helper.itemHelper.isOfBaseclass(item._id, BaseClasses.BACKPACK)) {
+                    for (const [_, grid] of Object.entries(item._props.Grids)) {
+                        if (!grid?._props?.filters) continue;
+                        grid._props.filters = [
+                            {
+                                Filter: [BaseClasses.ITEM],
+                                ExcludedFilter: [],
+                            },
+                        ];
+                    }
                 }
             }
         }
```

**验证**：Items 的 `DiscardLimit` 和背包的 Grid Filters 行为不变。

---

### P0-3: 修复 Sandbox_high 大小写不一致 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Server/src/mod.ts` |
| 行号 | 109-111 |
| 风险 | 低（改动仅影响路径逻辑） |

**背景**：客户端 `Settings.cs:347` 在 `GetAllottedPoints()` 中做了 `.ToLower()`，服务端未做。Linux 文件系统大小写敏感时会导致数据分裂。

**改动**：

```diff
 public static getProfileDataPath(profileId: string, mapId: string): string {
-    let mapName: string = mapId;
-    if (mapId === "factory4_day" || mapId === "factory4_night") {
+    let mapName: string = mapId.toLowerCase();
+    if (mapName === "factory4_day" || mapName === "factory4_night") {
         mapName = "factory";
     }
-    if (mapId === "Sandbox_high") {
-        mapName = "Sandbox";
+    if (mapName === "sandbox_high") {
+        mapName = "sandbox";
     }

     const folderPath: string = this.getProfileFolderPath(profileId);
     const filePath: string = FileUtils.pathCombine(folderPath, `${mapName}.json`);
```

**验证**：Ground Zero 高低配版本的放置数据保存到同一个 `sandbox.json` 文件。

---

### P0-4: 修复 SpawnAllPlacedItems 计数器死锁 (15分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Components/LITSession.cs` |
| 行号 | 73-113 |
| 风险 | 中（核心启动逻辑） |

**问题**：`data.Item == null` 时跳过物品但 `_itemsSpawned` 不递增，导致 `_itemsSpawned >= _itemsToSpawn` 永远达不到，LootExperience 永久禁用。

**改动**：

```diff
 _itemsToSpawn = dataPack.ItemTemplates.Count;
 
 if (_itemsToSpawn > 0)
 {
     LootExperienceEnabled = false;
 }

 for (int i = 0; i < dataPack.ItemTemplates.Count; i++)
 {
     PlacedItemData data = dataPack.ItemTemplates[i];
-    if (data.Item == null) continue;
+    if (data.Item == null)
+    {
+        _itemsSpawned++;
+        if (_itemsSpawned >= _itemsToSpawn)
+        {
+            Instance.LootExperienceEnabled = true;
+            LITStaticEvents.InvokeOnLastPlacedItemSpawned(null);
+        }
+        continue;
+    }

     ItemHelper.SpawnItem(data.Item, new Vector3(0, -9999, 0), data.Rotation,
     (LootItem lootItem) =>
     {
         // ... existing callback logic unchanged ...
     });
 }
```

**验证**：
1. 在 mod 物品更新后进入 raid — 不出现经验值不增加的 bug
2. `OnLastPlacedItemSpawned` 事件正常触发

---

## Phase 1 — P1 应该尽快修复 (~3.5小时)

### P1-1: ServerRoute 同步 HTTP 阻塞主线程 (2-3小时)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/LITUtils.cs` (106-111) + 所有调用点 |
| 风险 | **高**（涉及游戏启动/退出两个关键路径） |
| 类型 | 重构 |

**当前问题**：
- `LITSession.Awake()` → 调用 `ServerRoute()` → 同步等待 HTTP，冻结游戏画面
- `GameEndedPatch.Prefix()` → 调用 `SendPlacedItemDataToServer()` → 同步等待，延长退出黑屏

**方案**：

步骤 1：在 `LITUtils.cs` 添加异步版本的 `ServerRoute`：

```csharp
// 新增方法
public static IEnumerator ServerRouteCoroutine<T>(string url, T data, Action<T> callback)
{
    string json = JsonConvert.SerializeObject(data);
    
    // 在后台线程执行 HTTP 请求
    string result = null;
    bool done = false;
    System.Threading.ThreadPool.QueueUserWorkItem(_ =>
    {
        result = RequestHandler.PostJson(url, json);
        done = true;
    });
    
    while (!done) yield return null;
    
    T deserialized = JsonConvert.DeserializeObject<T>(result);
    callback?.Invoke(deserialized);
}
```

步骤 2：修改 `LITSession.Awake()` 中的 `SpawnAllPlacedItems` 为协程模式：

```diff
 private void Awake()
 {
     GameWorld = Singleton<GameWorld>.Instance;
     Player = GameWorld.MainPlayer;
     GamePlayerOwner = Player.GetComponent<GamePlayerOwner>();
-    SpawnAllPlacedItems();
+    StartCoroutine(SpawnAllPlacedItemsCoroutine());
 }

-private void SpawnAllPlacedItems()
+private IEnumerator SpawnAllPlacedItemsCoroutine()
 {
-    PlacedItemDataPack dataPack = LITUtils.ServerRoute<PlacedItemDataPack>(Plugin.DataToClientURL, PlacedItemDataPack.Request);
+    bool dataReceived = false;
+    PlacedItemDataPack dataPack = null;
+    yield return StartCoroutine(LITUtils.ServerRouteCoroutine<PlacedItemDataPack>(
+        Plugin.DataToClientURL, PlacedItemDataPack.Request, (result) => { dataPack = result; dataReceived = true; }
+    ));
+    // 协程内继续原有逻辑...
     GlobalAddonData = dataPack.GlobalAddonData;
     // ... 其余生成逻辑不变 ...
 }
```

步骤 3：修改 `GameEndedPatch` 中的保存为异步：

```diff
 if (FikaBridge.IAmHost())
 {
-    session.SendPlacedItemDataToServer();
+    LITUtils.ServerRouteAsync(Plugin.DataToServerURL, dataPack); // fire-and-forget
 }
```

添加 fire-and-forget 方法：

```csharp
public static void ServerRouteAsync<T>(string url, T data)
{
    System.Threading.ThreadPool.QueueUserWorkItem(_ =>
    {
        string json = JsonConvert.SerializeObject(data);
        RequestHandler.PostJson(url, json);
    });
}
```

**验证**：
1. 进入有大量已放置物品的地图 — 无画面冻结
2. 退出 raid — 退出黑屏时间不显著延长
3. 放置的物品在下一局正常恢复

---

### P1-2: GetAllottedPoints 未知地图崩溃 (10分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/Settings.cs` |
| 行号 | 347 |
| 风险 | 低 |

**改动**：

```diff
 public static int GetAllottedPoints()
 {
-    return _itemCountLookup[Singleton<GameWorld>.Instance.LocationId.ToLower()].Value;
+    string locId = Singleton<GameWorld>.Instance.LocationId.ToLower();
+    if (!_itemCountLookup.TryGetValue(locId, out var entry))
+    {
+        Plugin.LogSource.LogWarning($"Unknown map: {locId}, using default points (unlimited).");
+        return int.MaxValue;
+    }
+    return entry.Value;
 }
```

**验证**：进入自定义 mod 地图 — game 不崩溃。

---

### P1-3: Settings 标签重复 "8:" (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/Settings.cs` |
| 行号 | 159 |
| 风险 | 零 |

**改动**：

```diff
 BackgroundColor = config.Bind(
     _moveModeSectionName,
-    "8: Background Color",
+    "9: Background Color",
     new Color(0.6037736f, 0.5685925f, 0.504094f, 1),
     new ConfigDescription("", null, new ConfigurationManagerAttributes() { IsAdvanced = true })
 );
```

**验证**：F12 ConfigurationManager 中 Background Color 显示在 Click Color 之后。

---

### P1-4: 删除 HandleFallPatch 死代码 (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `HomeComforts-Core/Patches/HandleFallPatch.cs` |
| 风险 | 零（已注释禁用） |

**操作**：删除整个文件。

**验证**：编译通过。

---

### P1-5: 删除 LayerSetterInfo 未使用的结构体 (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `HomeComforts-Core/Plugin.cs` |
| 行号 | 58-63 |
| 风险 | 零 |

**改动**：

```diff
-    public struct LayerSetterInfo
-    {
-        public string TemplateId;
-        public List<string> GameobjectNames;
-        string LayerName;
-    }
```

**验证**：编译通过。

---

### P1-6: SafehouseSession 冗余检查 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `HomeComforts-Core/Items/Safehouse/SafehouseSession.cs` |
| 行号 | 对应 OnLastPlacedItemSpawned 方法 |
| 风险 | 低 |

**改动**：

```diff
 if (!_session.AddonData.ContainsProfile()) return;

 SafehouseGlobalAddonData.ProfileData profileData = _session.AddonData.GetProfile();

 Safehouse safehouse = _session.GetSafehouseOrNull(profileData.SafehouseId);

 if (safehouse != null && safehouse.SafehouseEnabled)
 {
     HCSession.Instance.Player.Teleport(profileData.InfilPosition);
 }
-else
-{
-    if (_session.AddonData.ContainsProfile())
-    {
-        _session.AddonData.RemoveProfile();
-        SafehouseProfileDataToHostPacket.Instance.Send(true);
-    }
-}
+else
+{
+    // 安全屋已被移除或禁用，清理过期的 profile 数据
+    _session.AddonData.RemoveProfile();
+    SafehouseProfileDataToHostPacket.Instance.Send(true);
+}
```

**验证**：进入无安全屋的地图 — 不报错，profile 数据被正确清理。

---

### P1-7: InteractionHelper 异常静默吞没 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/InteractionHelper.cs` |
| 行号 | 37 |
| 风险 | 低 |

**改动**：

```diff
-    catch (System.Exception) { } // sometimes this causes errors, don't really care in those cases so just avoid the exception
+    catch (System.Exception ex)
+    {
+#if DEBUG
+        Plugin.LogSource.LogDebug($"RefreshPrompt suppressed: {ex.Message}");
+#endif
+    }
```

**验证**：Debug 构建中 F12 控制台可看到被吞没的异常信息。

---

### P1-8: SpaceHeaterAddonData 单例共享 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `HomeComforts-Core/Items/SpaceHeater/SpaceHeaterAddonData.cs` |
| 风险 | 低 |

**改动**：

```diff
-    [JsonIgnore]
-    private static SpaceHeaterAddonData _enabledData = new(true);
-    [JsonIgnore]
-    private static SpaceHeaterAddonData _disabledData = new(false);
-
     public static SpaceHeaterAddonData CreateData(bool enabled)
     {
-        if (enabled)
-        {
-            return _enabledData;
-        }
-        else
-        {
-            return _disabledData;
-        }
+        return new SpaceHeaterAddonData(enabled);
     }
```

**验证**：多个暖炉的开关状态独立互不影响。

---

## Phase 2 — P2 性能优化 (~2.5小时)

8 个任务互不依赖，可并行执行。

### P2-1: GetAllDescendants 改为回调模式 (30分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/LITUtils.cs` (93-104) + `FakeItem.cs` (159-173) |
| 风险 | 中 |

**LITUtils.cs — 新增回调方法，保留原方法标记废弃**：

```csharp
/// <summary>
/// 对 GameObject 的所有子物体（递归）执行操作，无 GC 分配。
/// </summary>
public static void ForAllDescendants(GameObject parent, Action<GameObject> action)
{
    foreach (Transform child in parent.transform)
    {
        action(child.gameObject);
        ForAllDescendants(child.gameObject, action);
    }
}
```

**FakeItem.cs — 调用点改为回调模式**：

```diff
-    List<GameObject> descendants = LITUtils.GetAllDescendants(gameObject);
-    foreach (GameObject descendant in descendants)
-    {
-        if (descendant.GetComponent<Collider>() == null) continue;
-        if (descendant.name.Contains("LITKeepLayer")) continue;
+    LITUtils.ForAllDescendants(gameObject, descendant =>
+    {
+        if (descendant.GetComponent<Collider>() == null) return;
+        if (descendant.name.Contains("LITKeepLayer")) return;

         if (enabled)
         {
             descendant.layer = GetCollisionEnabledLayerNumber(descendant.name);
         }
         else
         {
             descendant.layer = LayerMask.NameToLayer("Loot");
         }
-    }
+    });
```

**验证**：物品放置/移动后的碰撞行为不变，Unity Profiler 显示 SetPlayerAndBotCollisionEnabled 的 GC Alloc 显著减少。

---

### P2-2: GetLootItem 局部字典索引 (1小时)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/ItemHelper.cs` (21-28) + `LITSession.cs` |
| 风险 | 中（议会有同步问题警告） |

**策略**（遵循 Gamma 的建议）：**只索引 MOD 自身生成的 LootItem**，不索引 EFT 全局集合。

**LITSession.cs — 添加索引和维护方法**：

```csharp
private Dictionary<string, LootItem> _spawnedLootItemLookup = [];

internal void RegisterSpawnedLootItem(string itemId, LootItem lootItem)
{
    _spawnedLootItemLookup[itemId] = lootItem;
}

internal void UnregisterSpawnedLootItem(string itemId)
{
    _spawnedLootItemLookup.Remove(itemId);
}

public LootItem GetSpawnedLootItemFast(string itemId)
{
    _spawnedLootItemLookup.TryGetValue(itemId, out var result);
    return result;
}
```

在 `SpawnAllPlacedItems` 回调中注册：
```csharp
LITSession.Instance.RegisterSpawnedLootItem(data.Item.Id, lootItem);
```

在 `RemoveFakeItem` 中注销：
```csharp
UnregisterSpawnedLootItem(fakeItem.ItemId);
```

**ItemHelper.cs — GetLootItem 添加快速路径**：

```diff
 public static LootItem GetLootItem(string itemId)
 {
+    // 快速路径：检查 MOD 自身生成的物品
+    if (LITSession.Instance.TryGetFakeItem(itemId, out _))
+    {
+        var fast = LITSession.Instance.GetSpawnedLootItemFast(itemId);
+        if (fast != null) return fast;
+    }
+    // 回退：全图扫描
     foreach (LootItem lootItem in LITSession.Instance.GameWorld.LootItems.GetValuesEnumerator())
     {
         if (lootItem.ItemId == itemId) return lootItem;
     }
     return null;
 }
```

**验证**：物品回收功能正常，Profiler 显示 GetLootItem 耗时降低。

---

### P2-3: NavMeshObstacle carving 控制 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Components/FakeItem.cs` |
| 行号 | 145 |
| 风险 | 低 |

**改动**：

```diff
 _obstacle.shape = NavMeshObstacleShape.Box;
 _obstacle.center = collider.center;
 _obstacle.size = collider.size;
 _obstacle.carving = true;
-_obstacle.carveOnlyStationary = false;
+_obstacle.carveOnlyStationary = true;
```

**Extra**（可选）：在 `SetPlayerAndBotCollisionEnabled` 中根据物品尺寸决定是否启用 carving：

```csharp
// 小物品不需要 NavMesh carving
if (LootItem.Item.Width * LootItem.Item.Height < Settings.MinimumSizeItemToGetCollision.Value)
{
    _obstacle.carving = false;
}
```

**验证**：AI 的寻路行为不变，Profiler 显示 NavMesh 更新开销降低。

---

### P2-4: PlaceableItemFilter 改为 HashSet (15分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Common/ItemFilter.cs` + `Patches/GetAvailableActionsPatch.cs` |
| 风险 | 低（需确认 JSON 反序列化兼容） |

**ItemFilter.cs**：

```diff
-    public List<string> Whitelist = [];
-    public List<string> Blacklist = [];
+    public List<string> Whitelist = [];  // JSON 序列化用 List
+    public List<string> Blacklist = [];
+
+    [JsonIgnore]
+    public HashSet<string> WhitelistSet = [];
+    [JsonIgnore]
+    public HashSet<string> BlacklistSet = [];
+
+    public void BuildLookups()
+    {
+        WhitelistSet = new HashSet<string>(Whitelist);
+        BlacklistSet = new HashSet<string>(Blacklist);
+    }
```

**Plugin.cs — Awake 中调用 BuildLookups**：

```diff
 if (File.Exists(_itemFilterPath))
 {
     PlaceableItemFilter = JsonConvert.DeserializeObject<ItemFilter>(File.ReadAllText(_itemFilterPath));
 }
 else
 {
     PlaceableItemFilter = new ItemFilter();
     string json = JsonConvert.SerializeObject(PlaceableItemFilter);
     File.WriteAllText(_itemFilterPath, json);
 }
+PlaceableItemFilter.BuildLookups();
```

**GetAvailableActionsPatch.cs**：

```diff
-    if (Plugin.PlaceableItemFilter.WhitelistEnabled && !Plugin.PlaceableItemFilter.Whitelist.Contains(lootItem.Item.TemplateId)) return false;
-    if (Plugin.PlaceableItemFilter.BlacklistEnabled && Plugin.PlaceableItemFilter.Blacklist.Contains(lootItem.Item.TemplateId)) return false;
+    if (Plugin.PlaceableItemFilter.WhitelistEnabled && !Plugin.PlaceableItemFilter.WhitelistSet.Contains(lootItem.Item.TemplateId)) return false;
+    if (Plugin.PlaceableItemFilter.BlacklistEnabled && Plugin.PlaceableItemFilter.BlacklistSet.Contains(lootItem.Item.TemplateId)) return false;
```

**验证**：白名单/黑名单功能不变。

---

### P2-5: FakeItem.LootItem getter NRE 风险 (10分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Components/FakeItem.cs` |
| 行号 | 65-76 |
| 风险 | 低 |

**改动**：

```diff
 public ObservedLootItem LootItem
 {
     get
     {
-        if (_lootItem.Item == null || _lootItem.Item.Id == null)
+        if (_lootItem == null || _lootItem.Item == null || _lootItem.Item.Id == null)
         {
-            _lootItem = ItemHelper.GetLootItem(ItemId) as ObservedLootItem;
+            var found = ItemHelper.GetLootItem(ItemId);
+            if (found is ObservedLootItem observed)
+            {
+                _lootItem = observed;
+            }
+            else
+            {
+                Plugin.LogSource.LogError($"Failed to resolve LootItem for FakeItem {ItemId}");
+            }
         }
         return _lootItem;
     }
 }
```

**验证**：极端场景下（物品被 EFT 内部销毁）不崩溃。

---

### P2-6: SpawnItemRoutine 资源加载失败处理 (10分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Helpers/ItemHelper.cs` |
| 行号 | 99-103 |
| 风险 | 低 |

**改动**：

```diff
 Task loadTask = Singleton<PoolManagerClass>.Instance.LoadBundlesAndCreatePools(
     PoolManagerClass.PoolsCategory.Raid,
     PoolManagerClass.AssemblyType.Online,
     [.. collection],
     JobPriorityClass.Immediate,
     null,
     default);

 while (!loadTask.IsCompleted)
 {
     yield return new WaitForEndOfFrame();
 }
+
+if (loadTask.IsFaulted)
+{
+    Plugin.LogSource.LogError($"Failed to load bundles for item {item.ShortName}: {loadTask.Exception}");
+    yield break;
+}

 LootItem lootItem = SetupItem(item, new Vector3(-99999, -99999, -99999), Quaternion.identity);
```

**验证**：bundle 缺失时不出现粉紫材质。

---

### P2-7: onDataToServer 无错误处理 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Server/src/mod.ts` |
| 行号 | 83 |
| 风险 | 低 |

**改动**：

```diff
 public static onDataToServer(url: string, info: any, sessionId: string, output: string, helper: ModHelper): void {
     const data = JSON.parse(JSON.stringify(info));
     const mapId: string = data.MapId;
     const profileId: string = data.ProfileId;

     this.makeBackup(profileId);

     const path: string = this.getProfileDataPath(profileId, mapId);
-    fs.writeFileSync(path, JSON.stringify(info));
+    try {
+        fs.writeFileSync(path, JSON.stringify(info));
+    } catch (err) {
+        console.error(`[LeaveItThere]: Failed to save placed items data: ${err.message}`);
+    }
 }
```

**验证**：磁盘满时 raid 结束不静默失败，F12 控制台有错误提示。

---

### P2-8: LITSession._instance 跨局残留 (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Components/LITSession.cs` |
| 风险 | 极低 |

**改动**：在 `DestroyAllFakeItems()` 末尾或 `GameEndedPatch.Prefix()` 调用后添加：

```diff
 internal void DestroyAllFakeItems()
 {
     foreach (var kvp in FakeItems)
     {
         Destroy(kvp.Value.gameObject);
     }
+    _instance = null;
 }
```

**验证**：无功能变化，纯防御性编程。

---

## Phase 3 — P3 代码整洁 (~1.5小时)

### P3-1: JSON 风格统一（可选，10分钟）

| 项 | 值 |
|----|-----|
| 文件 | `HomeComforts-Server/config.json` |
| 风险 | 零 |

**操作**：将 HomeComforts 的 `config.json` 从驼峰改为下划线，同步修改 `mod.ts` 中的引用。

**不改也可以**：议会评级 P3，不影响功能。如果 HomeComforts 有外部文档引用原驼峰字段名，建议暂不改动。

---

### P3-2: 移除不必要的深拷贝 (5分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Server/src/mod.ts` |
| 行号 | 76, 87 |
| 风险 | 零 |

**改动**：

```diff
 // onDataToServer (行 76)
-const data = JSON.parse(JSON.stringify(info));
-const mapId: string = data.MapId;
-const profileId: string = data.ProfileId;
+const mapId: string = info.MapId;
+const profileId: string = info.ProfileId;

 // onDataToClient (行 87)
-const data = JSON.parse(JSON.stringify(info));
-const mapId: string = data.MapId;
-const profileId: string = data.ProfileId;
+const mapId: string = info.MapId;
+const profileId: string = info.ProfileId;
```

**验证**：物品保存/加载功能不变。

---

### P3-3: DebugLog 使用 LogInfo (1分钟)

| 项 | 值 |
|----|-----|
| 文件 | `LeaveItThere-Core/Plugin.cs` |
| 行号 | 90 |
| 风险 | 零 |

**改动**：

```diff
 public static void DebugLog(string message)
 {
 #if DEBUG
-    LogSource.LogError($"[Debug Log]: {message}");
+    LogSource.LogInfo($"[Debug Log]: {message}");
 #endif
 }
```

**验证**：Debug 构建中日志不再以红色错误显示。

---

### P3-4: 提取 MapIdResolver 消除重复 (1小时)

| 项 | 值 |
|----|-----|
| 文件 | 新建 `Helpers/MapIdResolver.cs`；修改 `Settings.cs` + `LITUtils.cs` |
| 风险 | 中（涉及多处引用） |

**新建文件 `LeaveItThere-Core/Helpers/MapIdResolver.cs`**：

```csharp
namespace LeaveItThere.Helpers
{
    /// <summary>
    /// 统一处理地图 ID 的归一化映射。
    /// factory4_day/night → factory, sandbox_high → sandbox 等。
    /// </summary>
    public static class MapIdResolver
    {
        private static readonly Dictionary<string, string> NormalizedMapIds = new()
        {
            { "factory4_day", "factory" },
            { "factory4_night", "factory" },
            { "sandbox_high", "sandbox" },
        };

        /// <summary>
        /// 归一化地图 ID（小写 + day/night 合并）。
        /// </summary>
        public static string Normalize(string mapId)
        {
            string lower = mapId.ToLower();
            return NormalizedMapIds.TryGetValue(lower, out var normalized) ? normalized : lower;
        }

        /// <summary>
        /// Factory 地图的方向映射与其它地图不同。
        /// </summary>
        public static bool IsFactoryMap(string mapId)
        {
            string normalized = Normalize(mapId);
            return normalized == "factory";
        }
    }
}
```

**Settings.cs — 替换 `_itemCountLookup` 中的键**：

使用 `MapIdResolver.Normalize()` 作为键，或直接在 Init 中使用归一化后的键。

**LITUtils.cs — 替换 `GetCardinalDirection` 中的硬编码**：

```diff
-    string locId = Singleton<GameWorld>.Instance.LocationId;
-    if (locId == "factory4_day" || locId == "factory4_night")
+    string locId = Singleton<GameWorld>.Instance.LocationId;
+    if (MapIdResolver.IsFactoryMap(locId))
     {
         if (angle >= 337.5 || angle < 22.5) return "South";
         // ...
```

**验证**：所有地图的点数分配和方向显示不变。

---

## 执行清单

### 可并行执行的批次

**第一批（全部独立）**：
- [ ] P0-1: mod.ts 日志名称
- [ ] P0-2: 空 if 语句体
- [ ] P0-3: Sandbox_high 大小写
- [ ] P0-4: SpawnAllPlacedItems 死锁

**第二批（全部独立）**：
- [ ] P1-2: GetAllottedPoints 兜底
- [ ] P1-3: Settings 标签
- [ ] P1-4: 删除 HandleFallPatch
- [ ] P1-5: 删除 LayerSetterInfo
- [ ] P1-7: InteractionHelper log
- [ ] P1-8: SpaceHeaterAddonData 实例化

**第三批（全部独立）**：
- [ ] P1-1: ServerRoute 异步（工作量最大，可先单独处理）
- [ ] P1-6: SafehouseSession 逻辑简化

**第四批（全部独立）**：
- [ ] P2-1: GetAllDescendants 回调
- [ ] P2-2: GetLootItem 字典索引
- [ ] P2-3: NavMeshObstacle carving
- [ ] P2-4: PlaceableItemFilter HashSet
- [ ] P2-5: LootItem NRE
- [ ] P2-6: SpawnItemRoutine IsFaulted
- [ ] P2-7: onDataToServer try-catch
- [ ] P2-8: _instance 重置

**第五批（全部独立）**：
- [ ] P3-1: JSON 风格统一（可选）
- [ ] P3-2: 移除深拷贝
- [ ] P3-3: DebugLog → LogInfo
- [ ] P3-4: MapIdResolver 提取

### 验证 Checklist

- [ ] `npm run build` — LeaveItThere-Server 编译通过
- [ ] 客户端 DLL 编译通过（LeaveItThere + HomeComforts）
- [ ] 进入 raid — 无崩溃
- [ ] 放置物品 — 功能正常
- [ ] 搜索容器 — 功能正常
- [ ] 移动物品（Move Mode）— 功能正常
- [ ] 回收物品 — 功能正常
- [ ] 退出 raid — 下一局物品恢复正常
- [ ] 控制台命令（list/reclaim_all）— 功能正常
- [ ] 暖炉开关 — 功能正常
- [ ] 安全屋撤离 — 功能正常
- [ ] 安全屋重生 — 功能正常
- [ ] F12 BepInEx 控制台 — 无异常红色日志

---

*Vault-Tec 工程部 — 实施计划终端*
*"Preparing for the Future — execution is the key to survival!"*
