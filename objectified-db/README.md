# objectified-db

This is the database portion of the project.

The database schema is designed for PostgreSQL, using pgvector for vectorized data stores.

## Table Structure

Unless otherwise specified, all tables contain an ID column at the head, which is defined as a
UUID.  The UUID object is set with `uuid_generate_v4()`, used for security as they are generated using
cryptographic randomness.

### Users, Groups, and Tenancy

Stored tables have a deleted, created, and updated timestamp.  The purpose for these columns is so
data is soft-deleted.  No data is actually removed from the database, only marked as deleted
by the `enabled` column.

#### Users

Users are defined by an email address and password.  The verified flag indicates if the user has been
verified as a legitimate user.

#### Groups

Groups are logical groupings of users and other groups.  Groups contain the name, description, and an
identifier slug.

#### Tenants

Tenants are physical groupings of data, groups, and users.  Tenants contain a name, description,
and an identifier slug.

### Permissions

Permissions tables are non-soft-deleted.  Therefore, they only contain a `created_at` and `updated_at`
field to indicate changes.  Deletions will delete the records.

#### Roles

Roles are groupings of permissions.  Roles contain a name and description.

#### Permissions

Permissions are permissions that can be assigned to roles.  Permissions contain a name and
description.  Name contains the name of the permission that can be used.

#### Role Permissions

Role permissions are assignments of permissions to roles.  Role permissions contain a
role ID, permission ID, and a scope (allow/deny).

#### User Roles

User roles are assignments of roles to users.  User roles contain a user ID, role ID,
tenant ID, and group ID.

## User, Group, and Tenancy Groupings

### User Groups

User groups are assignments of users to groups.  User groups contain a user ID and a
group ID.

### Group Hierarchies

Group hierarchies are assignments of groups to other groups.  Group hierarchies contain
a parent group ID and a child group ID.

### Tenant Users

Tenant users are assignments of users to tenants.  Tenant users contain a tenant ID and
a user ID.

### Group Administrators

Group administrators are assignments of users to groups.  These are the users that can administer
users to groups, along with user/group management.  Group administrators contain
a group ID and a user ID.  Their permissions may also be altered by the role permissions tables.

### Tenant Administrators

Tenant administrators are assignments of users to tenants.  These are the users that can administer
users to tenants, along with user/tenant management.  Tenant administrators contain
a tenant ID and a user ID.  Their permissions may also be altered by the role permissions tables.

## Stored Procedures

## Triggers

| Trigger Name                                 | Description                                                                                        | Triggered Action             |
|----------------------------------------------|----------------------------------------------------------------------------------------------------|------------------------------|
| `cleanup_expired_verification_codes_trigger` | Cleans up expired verification codes by checking expiration time and deleting the entry if expired | Before Insert, Before Update |
