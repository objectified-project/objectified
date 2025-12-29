# Template Marketplace

This is a marketplace where users can post and share different property templates for various use
cases.

## 🛒 Template Marketplace (NEW)

> **Priority**: 🔴 Critical | **Timeline**: Q1 2026 | **Effort**: 3 weeks

### Community Template Library

**Template Categories** 📋 PLANNED
- 📋 **Industry Patterns**:
    - 📋 E-commerce (Product, Cart, Order, Payment, Shipping)
    - 📋 Healthcare (Patient, Appointment, Medication, Insurance)
    - 📋 Finance (Account, Transaction, Investment, Loan)
    - 📋 SaaS (Tenant, User, Subscription, Usage)
    - 📋 Education (Course, Student, Assignment, Grade)
    - 📋 Real Estate (Property, Listing, Agent, Transaction)
    - 📋 Logistics (Shipment, Route, Warehouse, Delivery)
- **Authentication & Authorization**:
    - OAuth 2.0 flow models
    - JWT token structures
    - User roles and permissions
    - Multi-factor authentication
    - API key management
- **Common Data Models**:
    - Address (US, International)
    - Person (Contact, Employee)
    - Organization/Company
    - Payment methods (Credit card, ACH, Crypto)
    - Communication (Email, SMS, Push notification)
    - Audit log and history
- **API Patterns**:
    - CRUD operations template
    - Pagination patterns (cursor, offset)
    - Search and filtering
    - Bulk operations
    - Batch processing
    - Webhook payload structures
- 📋 **Domain-Specific**:
    - 📋 IoT device schemas
    - 📋 Social media entities
    - 📋 Gaming (Player, Match, Leaderboard)
    - 📋 Travel & hospitality
    - 📋 Media & entertainment

| Ticket | Feature Description                                         |
|--------|-------------------------------------------------------------|
| #242   | Add industry-specific schema categories                     |
| #243   | Add domain specific schema categories                       |

**Template Structure**
- Each template includes:
    - Complete class definitions with properties
    - Pre-configured relationships
    - Example values and descriptions
    - Best practices documentation
    - Common validation rules
    - Optional paths/operations
    - Usage examples and code snippets
- Template metadata:
    - Name, description, category
    - Author and contributors
    - Version number and changelog
    - Tags for discoverability
    - Compatibility (OpenAPI version)
    - License (MIT, Apache, etc.)
    - Downloads count and rating

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Template Discovery**
- Browse templates by category
- Search templates by keyword
- Filter by:
    - Industry
    - Complexity (simple, moderate, complex)
    - Rating (stars)
    - Downloads (popularity)
    - Recently updated
    - Compatible with your OpenAPI version
- Featured templates (curated by admins)
- Trending templates (this week/month)
- Related templates suggestions

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Template Preview**
- Visual preview of template structure
- Canvas preview showing classes and relationships
- Generated code preview (TypeScript, Python, etc.)
- Sample OpenAPI spec preview
- Screenshots/diagrams
- Live demo (interactive playground)

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

### Template Import & Customization

**One-Click Import** 📋 PLANNED
- "Use Template" button from marketplace
- 📋 Template wizard guides through import:
    1. 📋 Select destination project/version
    2. 📋 Choose classes to import (select all or subset)
    3. 📋 Preview on canvas before committing
    4. 📋 Resolve naming conflicts
    5. 📋 Customize class names and namespaces
    6. 📋 Import with one click
- Bulk import multiple templates
- Template dependencies (auto-import related templates)

| Ticket | Feature Description                        |
|--------|--------------------------------------------|
| #220   | Improve import using a wizard with guides  |

**Template Customization**
- Customize before import:
    - Rename classes and properties
    - Add/remove properties
    - Change data types
    - Modify relationships
    - Add custom validation rules
- Save customized template as new template
- Fork template and modify
- Merge template updates while preserving customizations

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

**Smart Merging**
- Detect conflicts with existing schema
- Preview merge conflicts
- Conflict resolution UI:
    - Keep existing
    - Use template version
    - Merge both
    - Rename and keep both
- Intelligent property merging
- Relationship reconciliation

| Ticket | Feature Description                              |
|--------|--------------------------------------------------|

---

# Completed
