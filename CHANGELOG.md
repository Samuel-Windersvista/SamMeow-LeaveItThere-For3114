# LeaveItThere — 更新日志

## v2.0.2 (2026-06-03) — 3.11.4 稳定性修复版

### Bug 修复 (P0)
- 修复服务端日志中将 MOD 名称误写为 "[HomeComforts]" 的问题
- 删除 postDBLoad 中冗余的空 if 语句体，重构条件判断
- 修复 Ground Zero 地图大小写不一致导致的跨平台数据分裂风险（Linux 服务器）
- **修复 SpawnAllPlacedItems 物品生成计数器死锁** — 当已放置物品因 mod 更新无法反序列化时，整个 raid 的经验值获取被永久禁用

### 改进 (P1)
- GetAllottedPoints() 添加未知地图兜底 — 进入 mod 自定义地图不再崩溃
- Settings 中 Background Color 标签编号修复（"8:" → "9:"）
- InteractionHelper 异常不再完全静默吞没（DEBUG 模式记录日志）
- ServerRoute 保存数据改为异步 fire-and-forget — 退出 raid 时不再阻塞主线程

### 性能优化 (P2)
- GetAllDescendants 改为回调模式 — 消除递归中的临时 List 内存分配
- Add LootItem 局部字典索引 — 物品查找从 O(n) 降为 O(1)
- NavMeshObstacle `carveOnlyStationary` 改为 true — 降低 AI 寻路更新开销
- PlaceableItemFilter 白/黑名单改用 HashSet 查询
- FakeItem.LootItem getter 添加 null 保护 — 防止极端场景 NRE
- SpawnItemRoutine 添加 IsFaulted 检查 — 资源加载失败时正确中断
- 服务端 onDataToServer 添加 try-catch 错误处理
- LITSession._instance 局结束后正确重置

### 代码整洁 (P3)
- 移除服务端 onDataToServer/onDataToClient 中不必要的 JSON 深拷贝
- DebugLog 改用 LogInfo 替代 LogError
- 移除 HomeComforts 相关死代码引用

---

## v2.0.1 — 原始版本
- 初始 SPT 3.11.4 移植
