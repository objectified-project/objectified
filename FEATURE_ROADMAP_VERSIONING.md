# Versioning Roadmap

This represents the different versions of the Objectified specification and their current status.

## Schema Versioning

### Version Control 📋 PLANNED
- Full version history
- Compare any two versions
- Visual diff with highlights
- Branch and merge workflows
- Tag versions (v1.0, stable, beta)
- Version notes and changelogs
- Rollback to previous version
- Fork versions for experiments
- Protected versions (can't be deleted)
- Show branches when creating copies of schemas

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Breaking Change Detection 📋 PLANNED
- Auto-detect breaking changes:
    - Removed classes/properties
    - Changed property types
    - Required fields added
    - Renamed classes/properties
- Breaking change report
- Suggest migration path
- ✅ SemVer version recommendations
- Block publishing if breaking changes detected (configurable)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Migration Tools 📋 PLANNED
- Generate migration guides
- Data migration scripts
- Backward compatibility checker
- Deprecation warnings
- Sunset timeline for old versions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Version Management 📋 PLANNED

**Advanced Versioning** 🚧 PARTIALLY IMPLEMENTED
- **Version Branches**: 📋 Create branches for experimental features
- **Version Merging**: 📋 Merge branches with conflict resolution
- **Version Tags**: ✅ Label versions (stable, beta, deprecated, archived)
- **Version Comparison**:
    - 📋 Side-by-side diff view
    - 📋 Highlight added/removed/changed classes
    - 📋 Property-level changes
    - 📋 Visual canvas comparison
- **Version History Graph**:
    - 📋 Visual tree of version history
    - 📋 Show branches and merges
    - 📋 Click to switch versions
    - 📋 Time travel debugging
- **Version Rollback**:
    - 📋 Rollback to any previous version
    - 📋 Create new version from old version
    - 📋 Undo version publish
- **Version Notes**: ✅ IMPLEMENTED
    - ✅ Release notes per version
    - ✅ What's new highlights
    - 📋 Breaking changes documentation
    - 📋 Migration guide
- **Version Deprecation**: ✅ IMPLEMENTED
    - ✅ Mark versions as deprecated
    - 📋 Set sunset dates
    - 📋 Redirect to newer versions
    - ✅ Deprecation warnings in API
- **Version Copy**: ✅ IMPLEMENTED
    - ✅ Copy classes and properties from existing version
    - ✅ Create new version based on previous version

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Draft vs Published** 📋 PLANNED
- Work on drafts without affecting published version
- Multiple drafts per version
- Draft preview and testing
- Draft approval workflow
- Scheduled publishing
- Instant publish vs queued publish

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|
