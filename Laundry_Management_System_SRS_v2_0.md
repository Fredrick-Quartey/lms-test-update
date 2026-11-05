<sub>NOVA CREATE HUB  ·  INTERN DEVELOPMENT PROGRAMME</sub>

# Laundry Management System

## Software Requirements Specification (SRS)

*Intern build baseline  ·  Reusable client template (minimal roles)*

| Document information | Detail |
|---|---|
| Document ID | NCH-SRS-LDY |
| Version | 2.0 |
| Status | Baseline — approved for intern build |
| Date | September 2026 |
| Document owner | NOVA CREATE HUB Intern Development Programme |
| Intern project team | Intern Project Team 2 |
| Classification | Internal — training and client template |

> *This specification is a training baseline and a reusable client template. Before any client deployment, confirm the configuration defaults (section 5.3) and role assignments (sections 2.3–2.4) and issue a new version.*

---

# Document Control

## System

| No. | System ID | System Name | Delivery Phase |
|---|---|---|---|
| 1 | NCH-LDY-01 | Laundry Management System | Release 1 — Intern Build (MVP) |

## Revision History

| Date | Version | Description of Change | Author / Reviser |
|---|---|---|---|
| September 2026 | 1.0 | Initial SRS baseline for the intern build. | Intern Development Programme |
| September 2026 | 2.0 | Identifiers of the previous programme owner removed; document restructured to the house template; gap analysis applied (minimal role model, segregation-of-duties rules, new requirements, interface, configuration, and compliance sections). See Appendix C. | NOVA CREATE HUB |

## Approvals

| Responsibility | Name and Title | Signature | Date |
|---|---|---|---|
| Prepared by |  |  |  |
| Reviewed by (Security) |  |  |  |
| Approved by (Programme Supervisor) |  |  |  |
| Accepted by (Client — for client deployments) |  |  |  |

## References

| Ref ID | Document Title | Source | Version | Date | Purpose / Description |
|---|---|---|---|---|---|
| REF-001 | Intern Project Team Allocation | NOVA CREATE HUB Intern Development Programme | — | 2026 | Assigns backend, frontend, UI/UX, and security ownership for this build. |
| REF-002 | ISO/IEC/IEEE 29148:2018 — Requirements engineering | ISO / IEC / IEEE | 2018 | 2018 | Reference structure for SRS content and requirement quality attributes. |
| REF-003 | Data Protection Act, 2012 (Act 843) | Republic of Ghana | — | 2012 | Privacy obligations for personal data (substitute the equivalent law for deployments outside Ghana). |
| REF-004 | OWASP Top 10 and OWASP ASVS 4.0 | OWASP Foundation | 4.0 | 2021 | Security verification baseline (section 6.1). |
| REF-005 | Web Content Accessibility Guidelines (WCAG) 2.1 | W3C | 2.1 | 2018 | Accessibility target (section 6.4). |

## Contents

- [**1. Introduction**](#1-introduction)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Scope](#12-scope)
  - [1.3 Intended Audience and How to Use This Document](#13-intended-audience-and-how-to-use-this-document)
  - [1.4 Document Conventions](#14-document-conventions)
  - [1.5 Definitions, Acronyms and Abbreviations](#15-definitions-acronyms-and-abbreviations)
- [**2. Overall Description**](#2-overall-description)
  - [2.1 Product Perspective](#21-product-perspective)
  - [2.2 Product Functions — Overview](#22-product-functions--overview)
  - [2.3 User Roles (Minimal Role Model)](#23-user-roles-minimal-role-model)
  - [2.4 Segregation of Duties and Role Consolidation](#24-segregation-of-duties-and-role-consolidation)
  - [2.5 Status Matrix](#25-status-matrix)
  - [2.6 Operating Environment](#26-operating-environment)
  - [2.7 Assumptions and Dependencies](#27-assumptions-and-dependencies)
  - [2.8 System Use Case Overview](#28-system-use-case-overview)
  - [2.9 Delivery Phasing](#29-delivery-phasing)
- [**3. Functional Requirements**](#3-functional-requirements)
  - [3.1 Module A — Customer & Order Intake](#31-module-a--customer--order-intake)
    - [SRS-LDY-A-01: Customer Registration & Profile](#srs-ldy-a-01-customer-registration--profile)
    - [SRS-LDY-A-02: Order Creation & Item Cataloguing](#srs-ldy-a-02-order-creation--item-cataloguing)
    - [SRS-LDY-A-03: Intake Tagging & Item Tracking](#srs-ldy-a-03-intake-tagging--item-tracking)
    - [SRS-LDY-A-04: Special Instructions & Exception Flagging](#srs-ldy-a-04-special-instructions--exception-flagging)
    - [SRS-LDY-A-05: Order Cancellation](#srs-ldy-a-05-order-cancellation)
    - [SRS-LDY-A-06: Online Pickup / Drop-off Booking](#srs-ldy-a-06-online-pickup--drop-off-booking)
  - [3.2 Module B — Sorting & Processing Workflow](#32-module-b--sorting--processing-workflow)
    - [SRS-LDY-B-01: Sorting by Service Type and Batch Assignment](#srs-ldy-b-01-sorting-by-service-type-and-batch-assignment)
    - [SRS-LDY-B-02: Processing Stage Tracking (Wash / Dry / Iron)](#srs-ldy-b-02-processing-stage-tracking-wash--dry--iron)
    - [SRS-LDY-B-03: Machine and Resource Allocation](#srs-ldy-b-03-machine-and-resource-allocation)
    - [SRS-LDY-B-04: Reprocessing and Rework Handling](#srs-ldy-b-04-reprocessing-and-rework-handling)
  - [3.3 Module C — Quality Check & Packaging](#33-module-c--quality-check--packaging)
    - [SRS-LDY-C-01: Quality Control Inspection](#srs-ldy-c-01-quality-control-inspection)
    - [SRS-LDY-C-02: Damage and Loss Reporting](#srs-ldy-c-02-damage-and-loss-reporting)
    - [SRS-LDY-C-03: Packaging and Bundling](#srs-ldy-c-03-packaging-and-bundling)
  - [3.4 Module D — Pickup, Delivery & Order Fulfilment](#34-module-d--pickup-delivery--order-fulfilment)
    - [SRS-LDY-D-01: Ready-for-Pickup Notification](#srs-ldy-d-01-ready-for-pickup-notification)
    - [SRS-LDY-D-02: Delivery Scheduling and Dispatch](#srs-ldy-d-02-delivery-scheduling-and-dispatch)
    - [SRS-LDY-D-03: Proof of Delivery](#srs-ldy-d-03-proof-of-delivery)
    - [SRS-LDY-D-04: Order Fulfilment Status Tracking](#srs-ldy-d-04-order-fulfilment-status-tracking)
  - [3.5 Module E — Billing & Payment](#35-module-e--billing--payment)
    - [SRS-LDY-E-01: Pricing Configuration](#srs-ldy-e-01-pricing-configuration)
    - [SRS-LDY-E-02: Invoice Generation and Payment Capture](#srs-ldy-e-02-invoice-generation-and-payment-capture)
    - [SRS-LDY-E-03: Refunds and Price Adjustments](#srs-ldy-e-03-refunds-and-price-adjustments)
    - [SRS-LDY-E-04: Corporate Accounts and Credit Terms](#srs-ldy-e-04-corporate-accounts-and-credit-terms)
    - [SRS-LDY-E-05: Daily Cash-Up & Till Reconciliation](#srs-ldy-e-05-daily-cash-up--till-reconciliation)
  - [3.6 Module F — Reporting, Audit & Configuration](#36-module-f--reporting-audit--configuration)
    - [SRS-LDY-F-01: Dashboards and Reporting](#srs-ldy-f-01-dashboards-and-reporting)
    - [SRS-LDY-F-02: Immutable Audit Trail](#srs-ldy-f-02-immutable-audit-trail)
    - [SRS-LDY-F-03: System Configuration](#srs-ldy-f-03-system-configuration)
    - [SRS-LDY-F-04: User Account & Access Management](#srs-ldy-f-04-user-account--access-management)
    - [SRS-LDY-F-05: Notification Management](#srs-ldy-f-05-notification-management)
    - [SRS-LDY-F-06: Bulk Data Import for Go-Live](#srs-ldy-f-06-bulk-data-import-for-go-live)
- [**4. External Interface Requirements**](#4-external-interface-requirements)
  - [4.1 User Interfaces](#41-user-interfaces)
  - [4.2 Hardware Interfaces](#42-hardware-interfaces)
  - [4.3 Software Interfaces](#43-software-interfaces)
  - [4.4 Communications Interfaces](#44-communications-interfaces)
- [**5. Data Requirements**](#5-data-requirements)
  - [5.1 Key Data Entities](#51-key-data-entities)
  - [5.2 Data Retention and Privacy](#52-data-retention-and-privacy)
  - [5.3 Configuration Parameters and Suggested Defaults](#53-configuration-parameters-and-suggested-defaults)
- [**6. Non-Functional Requirements**](#6-non-functional-requirements)
  - [6.1 Security](#61-security)
  - [6.2 Performance](#62-performance)
  - [6.3 Reliability and Recovery](#63-reliability-and-recovery)
  - [6.4 Usability and Accessibility](#64-usability-and-accessibility)
  - [6.5 Availability](#65-availability)
  - [6.6 Maintainability](#66-maintainability)
  - [6.7 Compatibility, Localisation and Compliance](#67-compatibility-localisation-and-compliance)
  - [6.8 Constraints and Project Team](#68-constraints-and-project-team)
- [**Appendix A: Role–Permission Matrix**](#appendix-a-rolepermission-matrix)
- [**Appendix B: Requirements Traceability Matrix**](#appendix-b-requirements-traceability-matrix)
- [**Appendix C: Summary of Changes from Version 1.0**](#appendix-c-summary-of-changes-from-version-10)

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for the Laundry Management System (LDY). It is used in two ways: as the build specification for an intern project team in the NOVA CREATE HUB Intern Development Programme, and as a baseline specification that can be tailored for real laundry and dry-cleaning businesses using a minimal set of user roles. It specifies the full order lifecycle — from customer intake through sorting, processing, quality control, packaging, and pickup or delivery, to billing, payment, and daily cash-up — and guides backend and frontend development, testing, security review, and functional sign-off.

## 1.2 Scope

The Laundry Management System covers the end-to-end order cycle for a single laundry branch. The system does not control washing or drying machinery; it tracks the work performed on physical machines through staff-recorded stage transitions and tag scans.

| In scope | Out of scope (possible Phase 2) |
|---|---|
| Customer registration, order intake, tagging, and cancellation | Multi-branch / franchise consolidation |
| Sorting, batching, machine allocation, and processing stages | Loyalty and rewards programmes |
| Quality control, damage/loss reporting, and packaging | Delivery route optimisation and live GPS tracking |
| Pickup notification, delivery dispatch, and proof of delivery | Machine (IoT) integration |
| Pricing, invoicing, receipts, payments, refunds, corporate accounts, and daily cash-up | Inventory of detergents and consumables |
| Dashboards, audit trail, configuration, user and notification management, bulk data import | Live payment gateway integration (intern build) |

## 1.3 Intended Audience and How to Use This Document

| Reader | Start with |
|---|---|
| Intern developers (backend / frontend) | Section 2 for the big picture, then the module you own in section 3. Build every MUST requirement first (section 2.9), using the defaults in section 5.3. |
| UI/UX designer | Sections 2.3 (roles), 2.5 (statuses), and 4.1 (user interfaces), plus the Workflow and Error States of each requirement. |
| Security reviewer | Sections 2.4 (segregation of duties), 5.2 (privacy), 6.1 (security), and Appendix A (permissions). |
| Programme supervisor / client sponsor | Sections 1.2, 2.3–2.4, 2.9, and 5.3 — these are the decisions to confirm before UAT. |
| Tester | The Acceptance Criteria under each requirement, and Appendix B (traceability matrix). |

## 1.4 Document Conventions

| Convention | Meaning |
|---|---|
| Requirement ID | SRS-LDY-A-01 = Software Requirement · system code (LDY) · module letter · sequence number. The short form A-01 is used inside module tables. |
| MUST | Mandatory for Release 1 (MVP). The system is not acceptable without it. |
| SHOULD | Important; planned for Release 2, or Release 1 if time allows. A workaround exists. |
| COULD | Desirable; kept in the backlog and delivered only if capacity allows. |
| "must" / "cannot" | A binding rule the system enforces (not just a guideline shown to the user). |
| Given / When / Then | Acceptance criteria format: the starting situation, the action, and the expected result. Each is a test case. |
| {placeholder} | A value inserted at run time into an error message or notification, e.g. {amount}. |
| New in v2.0 | Marks a requirement added by the version 2.0 gap analysis (see Appendix C). |

## 1.5 Definitions, Acronyms and Abbreviations

| Term | Definition |
|---|---|
| Batch | A group of compatible items processed together through a stage (e.g., a wash load). |
| Corporate Account | A business customer account billed on agreed credit terms rather than paid per order. |
| Go-Live | The date the system becomes the system of record. For the intern build, the demo-readiness date; for a client deployment, the agreed cut-over date. |
| LDY | Laundry Management System, the system defined by this SRS. |
| Maker-Checker | A control in which the person who prepares a transaction (maker) is different from the person who approves it (checker). |
| Minimal Role Model | The reduced set of user roles in section 2.3, designed so that a small organisation can operate the system with very few staff while keeping key controls. |
| MoSCoW | Prioritisation scheme used in this SRS: MUST, SHOULD, COULD (and WON'T for items explicitly excluded). |
| MVP | Minimum Viable Product — the smallest release that delivers the core workflow end to end (Release 1 in section 2.9). |
| Proof of Delivery | The signature, photo, or other evidence captured at the point an order is handed to the customer. |
| QC | Quality Control — the inspection step after processing that determines whether an item is ready for packaging. |
| RBAC | Role-Based Access Control. |
| RPO / RTO | Recovery Point Objective (maximum acceptable data loss) / Recovery Time Objective (maximum acceptable time to restore service). |
| SLA | Service Level Agreement — here, the configured target turnaround time per service type. |
| SoD | Segregation of Duties — the control preventing one individual from both recording and independently approving the same refund or high-impact adjustment. |
| Tag | The unique identifier attached to an item or like-item bundle at intake, used to track it through every stage. |
| Turnaround Time | The elapsed time from order intake to the order being ready for pickup or delivery. |
| UAT | User Acceptance Testing — testing by the programme supervisor or client users to confirm the system meets this SRS before go-live. |

# 2. Overall Description

## 2.1 Product Perspective

The LDY is a standalone branch-operations platform, built around the following operating principles.

| Operating Principle | What it means in practice |
|---|---|
| Item-Level Traceability | Every physical item is tagged and tracked individually from intake to handover. |
| Non-Blocking Intake | A customer's order is acknowledged immediately while sorting and processing proceed asynchronously. |
| Enforced Stage Sequencing | An item cannot skip from processing to packaging without a recorded QC pass. |
| Configuration-Driven Policy | Pricing, turnaround SLAs, and batching rules are administrator-configurable, not hardcoded. |
| Immutable Audit Trail | Every status transition, QC outcome, payment, and refund is logged and cannot be edited in place. |

For the intern build, a payment gateway and SMS/delivery-dispatch integration may be stubbed or mocked rather than connected to a live external system (see section 2.7). A client deployment replaces these stubs with live connections, as described in section 4.

## 2.2 Product Functions — Overview

The LDY provides: customer registration and itemised order intake with per-item tagging; sorting into compatible processing batches with machine allocation and stage tracking; quality control inspection with damage/loss reporting and rework handling; packaging with a checked-off manifest; automatic pickup notification and delivery scheduling with proof of delivery; automatic invoice generation, payment capture, refunds, and corporate-account billing; and role-based dashboards, exportable reports, and an immutable audit trail across every order.

## 2.3 User Roles (Minimal Role Model)

Version 2.0 reduces the number of roles so that a small organisation can run the system with very few people, while keeping the controls that matter. A role is a set of permissions, not a job title: one person can hold several roles, subject to the rules in section 2.4.

| Role | Type | Responsibilities | Typically held by |
|---|---|---|---|
| Customer (Self-Service) | Core | Tracks own orders, views invoices, receipts and payment history; optionally books pickups online. | Every customer |
| Front Desk Officer | Core | Registers customers; creates, finalises and cancels orders; tags items; captures payments; confirms pickup; runs daily cash-up; prepares corporate statements (absorbs the v1.0 Cashier / Billing Officer role). Cannot authorise refunds. | Counter staff |
| Laundry Attendant | Core | Sorts items into batches, assigns machines, records processing stages and rework, performs QC inspections, reports damage, and packages orders (absorbs the v1.0 Quality Control Officer role). | Production floor staff |
| Delivery Rider | Core (if delivery offered) | Carries out scheduled pickups and deliveries; records outcomes and proof of delivery. | Riders |
| Branch Manager | Core | Resolves damage reports; authorises refunds, adjustments, overrides and credit-limit exceptions; reviews cash-up variances; configures pricing and SLAs; reviews reports. | Manager or owner |
| System Administrator | Core | Configures price list, SLAs, batching rules, machine register, templates, tolerances, user accounts, and role assignments. | Owner, manager, or IT support |
| Auditor / Viewer | Optional | Read-only access to the full order, payment, and approval trail. Cannot create, approve, or modify. | Owner, accountant or auditor |

## 2.4 Segregation of Duties and Role Consolidation

The system enforces the following maker-checker rules at transaction level. They apply to the individual user, so they still protect the organisation when one person holds several roles.

| If a user performed… | …they cannot also… | Enforcement |
|---|---|---|
| Capture payments (Front Desk Officer) | Authorise a refund or price adjustment | Blocked (SRS-LDY-E-03) |
| Close a till / cash-up with a variance | Mark the same cash-up Reconciled | Blocked (SRS-LDY-E-05) |
| Complete an item's final processing stage | Record that item's QC outcome | Blocked only when Independent QC is enabled (SRS-LDY-C-01) |
| Request an order over a corporate credit limit | Approve the credit-limit override | Blocked (SRS-LDY-E-04) |

> **Running with a small team**
>
> A small branch can run LDY with as few as three staff accounts: (1) a Front Desk Officer, who may also hold the Laundry Attendant role; (2) a Laundry Attendant; and (3) a Branch Manager who also holds System Administrator. The Delivery Rider role is only needed if delivery is offered. Avoid giving the Front Desk Officer the Branch Manager role: the same person could then take a payment and refund it. Where the owner runs the counter personally, keep the daily cash-up report (SRS-LDY-E-05) under review by a second person, such as an accountant holding the Auditor role.

## 2.5 Status Matrix

The main lifecycle states the user sees and the system stores. "Manual step" shows whether a person must act to move the record forward.

| No. | Trigger / Action | User-Facing Status | System Description | System State | Manual Step |
|---|---|---|---|---|---|
| 1 | Order created | Draft | Freely editable; not yet handed to sorting | DRAFT | No |
| 2 | Order finalised at intake | Received | Tags assigned; handed to sorting | RECEIVED | No |
| 3 | Items sorted into a batch | In Sorting | Batch/machine assignment in progress | IN_SORTING | No |
| 4 | Batch processing underway | In Processing | Wash/dry/iron stages tracked per batch | IN_PROCESSING | No |
| 5 | QC outcome recorded | Passed / Failed | Failed items blocked from packaging | QC_PASSED / QC_FAILED | No / Yes |
| 6 | Order packaged | Packaged | Manifest fully checked off | PACKAGED | No |
| 7 | Customer notified / rider dispatched | Ready for Pickup / Out for Delivery | Notification or dispatch triggered automatically | READY_FOR_PICKUP / OUT_FOR_DELIVERY | No |
| 8 | Order handed over | Collected / Delivered | Payment or proof of delivery required | COLLECTED / DELIVERED | Yes |
| 9 | Payment settled | Paid | Outstanding balance reaches zero | PAID | No |
| 10 | Damage or refund resolved | Resolved | Branch Manager decision recorded | RESOLVED | Yes |
| 11 | Order cancelled before processing | Cancelled | Tags released; refund request raised if paid | CANCELLED | Yes |
| 12 | Unclaimed period expired | Unclaimed – Disposed | Branch Manager decision recorded; order closed | UNCLAIMED_DISPOSED | Yes |

## 2.6 Operating Environment

The system is a browser-based web application with a responsive interface for desktop, tablet, and mobile. The reference deployment is a Linux server (or managed cloud platform) running the application in containers, with a relational database (PostgreSQL recommended), scheduled jobs for time-based rules (accruals, reminders, escalations), and a queue for notifications. The intern build runs in a shared development environment with stubbed external services; a client deployment runs in a dedicated production environment with its own database, backups, and domain. Supported browsers and localisation settings are listed in section 6.7.

## 2.7 Assumptions and Dependencies

**Assumptions**

- A configured price list (simplified for the intern build) exists so orders can be priced automatically at intake.
- Turnaround SLAs, batching/compatibility rules, rework limits, and tolerances will be supplied or confirmed by the programme supervisor (intern build) or the client's project sponsor (client deployment) before UAT; section 5.3 lists suggested defaults.
- The intern build is demonstrated on a representative, synthetic data set — never on live customer data.
- The items listed as out of scope in section 1.2 are earmarked as possible Phase 2 extensions.
- No live payment gateway or SMS provider is connected in the intern build; payments and notifications are recorded or simulated within LDY.

**Dependencies**

- Notification service (in-app / SMS / email; stubbed in the intern build) — pickup-ready, reminder, and delivery-status alerts to customers, and internal alerts to staff.
- Payment capture (stub or mock in the intern build) — recording cash, card, and mobile money transactions with references.
- Identity & Access Management — authentication and RBAC enforcement (built into LDY per SRS-LDY-F-04, or a shared identity component where one is provided).
- Audit / logging store — immutable record of every order event, QC outcome, payment, refund, and configuration change.
- Tag/label printing and scanning — a label printer and barcode/QR scanner (or a simulated equivalent in the intern build) for item tracking.

## 2.8 System Use Case Overview

The LDY supports three primary flows. In the Intake-to-Processing flow, a Front Desk Officer registers or looks up a customer → creates an itemised order with service types and special instructions → finalises it, generating tags and an invoice → items are sorted into compatible batches and tracked through their configured processing stages. In the QC-to-Fulfilment flow, a Laundry Attendant inspects processed items → passed items are bundled into a checked-off packaging manifest → the customer is notified automatically or the order is scheduled onto a delivery route → handover is confirmed by payment and collection, or by a Delivery Rider's proof of delivery. In the Billing flow, an invoice generated at intake is settled at intake, at collection, or through a corporate account's periodic statement, with any refund or adjustment requiring Branch Manager approval. Seven actor roles (six core, one optional) interact with the LDY under role-based least privilege, from the Customer tracking their own order to the Auditor/Viewer with read-only access to the full transaction and approval trail.

## 2.9 Delivery Phasing

Requirements are delivered by priority so that every release is a working system. Interns build Release 1 end to end before starting Release 2.

| Release | Priority | Requirements included |
|---|---|---|
| Release 1 (MVP) | **MUST** | A-01, A-02, A-03, B-01, B-02, C-01, C-02, C-03, D-01, D-02, D-04, E-01, E-02, F-02, F-03, F-04 |
| Release 2 | **SHOULD** | A-04, A-05, B-03, B-04, D-03, E-03, E-05, F-01, F-05, F-06 |
| Backlog | **COULD** | A-06, E-04 |

# 3. Functional Requirements

Each module opens with a summary table of its requirements, followed by the detailed specification of each requirement: user story, requirements, validation rules, workflow, error states, and acceptance criteria.

## 3.1 Module A — Customer & Order Intake

**Requirement summary (LDY-FR-A)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| A-01 | LDY must let a Front Desk Officer register a new customer (or serve a walk-in as Guest) capturing contact details and standing preferences. | An order cannot be created for a customer profile missing a valid contact number. | **MUST** |
| A-02 | LDY must let a Front Desk Officer create an order against a customer, itemising each piece with service type and special instructions. | An order cannot be submitted with zero items or a missing service type per item. | **MUST** |
| A-03 | LDY must attach a unique, scannable tag per item or bundle at intake so every item can be tracked individually through every processing stage. | A tag number can never be reused across two open orders at the same time. | **MUST** |
| A-04 | LDY must let intake staff flag an item with special handling needs (stains, pre-existing damage, delicate fabric) that follow it through every stage. | A flagged item's special instructions are visible at every subsequent processing stage without needing to be re-entered. | **SHOULD** |
| A-05 | LDY must let a Front Desk Officer cancel a Received order, with a reason, until any of its items enters processing. | An order with any item already In Processing cannot be cancelled; any payment already taken is refunded only through SRS-LDY-E-03. | **SHOULD** |
| A-06 | LDY could let a registered customer book a pickup or drop-off slot through the customer portal. | A booking is converted into an order only when a Front Desk Officer itemises and finalises it at intake. | **COULD** |

---

### SRS-LDY-A-01: Customer Registration & Profile

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Front Desk Officer | Release 1 (MVP) | v1.0 baseline |

> *As a Front Desk Officer, I want quick customer registration, so returning customers don't have to repeat their details every visit.*

**Requirements**

- LDY lets a Front Desk Officer create a customer profile: name, phone number, email (optional), delivery address, and standing preferences (starch, softener, hanger vs. fold).
- A walk-in customer may be served as a one-off Guest without a saved profile, but a phone number is still required for order-status notifications.
- Returning customers are looked up by phone number to avoid duplicate profiles.
- Customers can self-register via a lightweight portal for online order booking.

**Validation Rules**

- A customer profile cannot be saved without a valid phone number format.

**Workflow**

1. Front Desk Officer searches by phone number
2. Found: profile and preferences reused
3. Not found: new profile or Guest created
4. Proceeds to order creation.

**Error States**

| Error | Message shown to the user |
|---|---|
| Duplicate Phone Number | *“A customer with this phone number already exists. Use the existing profile instead of creating a new one.”* |

**Acceptance Criteria**

- ✓ **Given** a returning customer's phone number is entered, **when** searched, **then** their existing profile and standing preferences are loaded automatically.
- ✓ **Given** a new phone number is entered with no match, **when** saved, **then** a new customer profile is created.

---

### SRS-LDY-A-02: Order Creation & Item Cataloguing

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Front Desk Officer | Release 1 (MVP) | v1.0 baseline |

> *As a Front Desk Officer, I want to itemise every piece at intake, so nothing gets lost or mischarged later in the process.*

**Requirements**

- LDY lets the Front Desk Officer add line items to an order: item description/category (shirt, trousers, bedsheet, etc.), quantity, service type, and special instructions.
- Each order is assigned a unique order number and a physical tag number per item or per like-item bundle at intake.
- The order records an expected ready-by date/time based on the configured turnaround SLA for the selected service types.
- Orders may be edited only before they leave Draft status, i.e., before intake is finalised and handed to sorting.

**Validation Rules**

- An order cannot be finalised with zero items, or any item missing a service type.

**Workflow**

1. Front Desk Officer adds items
2. Tags assigned
3. Expected ready-by calculated
4. Order finalised
5. Order status set to Received, handed to sorting.

**Error States**

| Error | Message shown to the user |
|---|---|
| Incomplete Order | *“This order cannot be finalised: every item needs a service type, and at least one item is required.”* |

**Acceptance Criteria**

- ✓ **Given** every item has a service type, **when** the order is finalised, **then** it is assigned an order number, tag numbers, and an expected ready-by date/time in the same action.
- ✓ **Given** an item is missing a service type, **when** finalisation is attempted, **then** it is blocked with a clear validation message.

---

### SRS-LDY-A-03: Intake Tagging & Item Tracking

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Laundry Attendant | Release 1 (MVP) | v1.0 baseline |

> *As a Laundry Attendant, I want every item tagged individually, so a piece from one customer's order never ends up mixed into someone else's bundle.*

**Requirements**

- LDY generates a unique tag number per item (or per like-item bundle) at order finalisation, printed on a physical tag/label.
- Scanning or entering a tag number at any processing stage looks up the item and its order instantly.
- A tag number is retired (available for reuse) only once its order reaches Collected/Delivered status.
- A lost or damaged physical tag can be reprinted by a Laundry Attendant without changing the underlying tag number.

**Validation Rules**

- A tag number cannot be assigned to two items with overlapping open-order status at the same time.

**Workflow**

1. Order finalised
2. Tag numbers generated and printed
3. Tags travel with items through sorting, processing, QC
4. Tag scanned at each stage updates item status
5. Order completed
6. Tags retired.

**Error States**

| Error | Message shown to the user |
|---|---|
| Tag Already In Use | *“This tag number is already assigned to an open order and cannot be reused.”* |

**Acceptance Criteria**

- ✓ **Given** an order is finalised, **when** tags are generated, **then** every item or bundle receives a unique tag number in the same action.
- ✓ **Given** a tag from a completed order is reused, **when** it's assigned to a new order, **then** the system allows it since the prior order is closed.

---

### SRS-LDY-A-04: Special Instructions & Exception Flagging

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Laundry Attendant | Release 2 | v1.0 baseline |

> *As a Laundry Attendant, I want to see an item's special instructions at every stage, so I don't accidentally put a delicate item through a standard wash cycle.*

**Requirements**

- At intake, an item can be flagged with structured tags (pre-existing stain, pre-existing damage, delicate fabric, no-starch, etc.) and free-text notes.
- Flags and notes travel with the item's record and are shown at every subsequent stage (sorting, processing, QC).
- A pre-existing damage or stain flag includes an optional photo taken at intake, for dispute protection.
- Any staff member at any stage can add a new exception flag if something is noticed later; this does not remove or alter the intake flag.

**Validation Rules**

- A pre-existing damage flag requires at least a text note if no photo is attached.

**Workflow**

1. Item flagged at intake with notes/photo
2. Flag travels with the item record
3. Visible at every stage
4. Staff reference it before processing decisions.

**Error States**

| Error | Message shown to the user |
|---|---|
| Missing Damage Note | *“A note or photo is required when flagging pre-existing damage.”* |

**Acceptance Criteria**

- ✓ **Given** an item is flagged as delicate at intake, **when** it reaches the processing stage, **then** the flag and notes are visible to the Laundry Attendant without re-entry.
- ✓ **Given** a pre-existing stain is flagged with a photo, **when** the order later reaches QC, **then** the photo is available for comparison against the item's current condition.

---

### SRS-LDY-A-05: Order Cancellation

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Front Desk Officer | Release 2 | **New in v2.0** |

> *As a Front Desk Officer, I want to cancel an order the customer changes their mind about, so that it leaves the workflow cleanly and nothing is processed or charged by mistake.*

**Requirements**

- A Front Desk Officer can cancel an order in Received or In Sorting status, selecting a reason (customer request, duplicate entry, other).
- Cancelling releases the order's tag numbers and removes its items from any batch that has not yet started.
- If payment was captured, the cancellation creates a refund request that follows the Branch Manager approval rule in SRS-LDY-E-03; the Front Desk Officer cannot pay it out directly.
- The customer is notified of the cancellation, and the order remains visible in history with status Cancelled.

**Validation Rules**

- An order cannot be cancelled once any of its items has entered In Processing; the Branch Manager handles such cases through the damage and refund process.

**Workflow**

1. Front Desk Officer selects order
2. System checks no item is In Processing
3. Reason recorded
4. Order set to Cancelled
5. Tags released
6. Refund request raised if payment exists
7. Customer notified.

**Error States**

| Error | Message shown to the user |
|---|---|
| Cannot Cancel — Processing Started | *“This order cannot be cancelled because processing has already started on one or more items. Ask the Branch Manager to review it.”* |

**Acceptance Criteria**

- ✓ **Given** an order is Received and no item has entered processing, **when** the Front Desk Officer cancels it with a reason, **then** its status becomes Cancelled and its tags are released.
- ✓ **Given** a cancelled order had been paid in full, **when** the cancellation is saved, **then** a refund request is created for Branch Manager approval rather than a refund being issued immediately.

---

### SRS-LDY-A-06: Online Pickup / Drop-off Booking

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **COULD** | Customer | Backlog | **New in v2.0** |

> *As a Customer, I want to book a pickup online, so that I do not have to call the branch to arrange collection of my laundry.*

**Requirements**

- A signed-in customer selects a service type, a pickup address (or drop-off at the branch), and an available time slot within configured operating hours.
- The branch sees bookings in a daily schedule; a Delivery Rider can be assigned to pickup bookings in the same way as deliveries (SRS-LDY-D-02).
- On arrival at the branch, a Front Desk Officer converts the booking into a Draft order, itemises it, and finalises it through the normal intake flow (SRS-LDY-A-02); prices are confirmed only at itemisation.
- The customer can cancel a booking up to a configured cut-off time before the slot.

**Validation Rules**

- A slot cannot be booked if it has already reached the configured maximum number of bookings.

**Workflow**

1. Customer selects service, address, and slot
2. Booking confirmed and notified
3. Rider collects or customer drops off
4. Front Desk converts booking to an order at intake.

**Error States**

| Error | Message shown to the user |
|---|---|
| Slot Full | *“This time slot is fully booked. Please choose another slot.”* |

**Acceptance Criteria**

- ✓ **Given** a slot has reached its maximum bookings, **when** a customer tries to book it, **then** the booking is refused and alternative slots are shown.
- ✓ **Given** a booking is converted at intake, **when** the order is finalised, **then** the booking is linked to the order and marked Completed.

## 3.2 Module B — Sorting & Processing Workflow

**Requirement summary (LDY-FR-B)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| B-01 | LDY must let a Laundry Attendant sort received items into processing batches grouped by service type and fabric/colour compatibility. | An item cannot be added to a batch whose service type doesn't match the item's ordered service type. | **MUST** |
| B-02 | LDY must track each batch through its processing stages (e.g., wash → dry → iron/press) with start/end times per stage. | A batch's overall status always reflects its furthest-completed stage without a manual status update. | **MUST** |
| B-03 | LDY must let a Laundry Attendant assign a batch to a specific machine or station and prevent double-booking. | A machine already running a batch cannot be assigned a second batch until it's marked available. | **SHOULD** |
| B-04 | LDY must let staff send an item back through a processing stage (rework) when it doesn't meet quality expectations, without losing its order/tag linkage. | A reworked item's original processing history is preserved alongside its rework record, not overwritten. | **SHOULD** |

---

### SRS-LDY-B-01: Sorting by Service Type and Batch Assignment

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Laundry Attendant | Release 1 (MVP) | v1.0 baseline |

> *As a Laundry Attendant, I want items grouped into compatible batches automatically, so I don't have to manually cross-check every item's requirements before starting a load.*

**Requirements**

- LDY lets a Laundry Attendant create a processing batch for a service type (wash, dry-clean, iron-only) and add scanned items to it.
- The system prevents adding an item to a batch whose service type doesn't match the item's ordered service type, or whose colour/fabric category conflicts with configured batching rules.
- A batch records its start time, assigned machine/station, and the attendant responsible.
- An item's status updates to In Sorting then In Processing as it's added to and started in a batch.

**Validation Rules**

- A batch cannot be started with zero items.

**Workflow**

1. Items received from intake
2. Laundry Attendant scans items into a compatible batch
3. Batch started on an assigned machine/station
4. Item statuses update to In Processing.

**Error States**

| Error | Message shown to the user |
|---|---|
| Incompatible Batch | *“This item's service type or fabric category doesn't match this batch. Add it to a compatible batch instead.”* |

**Acceptance Criteria**

- ✓ **Given** an item's service type matches the batch, **when** it's scanned in, **then** it's added successfully and its status updates to In Sorting.
- ✓ **Given** an item's service type doesn't match the batch, **when** scanned, **then** it's rejected with a clear message naming the mismatch.

---

### SRS-LDY-B-02: Processing Stage Tracking (Wash / Dry / Iron)

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Branch Manager | Release 1 (MVP) | v1.0 baseline |

> *As a Branch Manager, I want to see exactly which stage every batch is at, so I can spot a bottleneck before it delays customer pickups.*

**Requirements**

- Each service type has a configured sequence of processing stages (e.g., Wash service: Wash → Dry → Fold; Dry-clean service: Solvent Clean → Press).
- A Laundry Attendant marks a stage as started and completed for a batch; the batch's overall status derives automatically from its current stage.
- Stage duration is tracked automatically (start to completion timestamp) for turnaround reporting.
- A batch delayed beyond a configured stage-duration threshold is flagged for Branch Manager attention.

**Validation Rules**

- A stage cannot be marked complete before it has been marked started.

**Workflow**

1. Batch starts its first configured stage
2. Attendant marks stage complete
3. Next stage in sequence begins automatically
4. Repeats until final stage complete
5. Batch status set to Processing Complete.

**Error States**

| Error | Message shown to the user |
|---|---|
| Stage Out of Sequence | *“This stage cannot be completed before it has been started.”* |

**Acceptance Criteria**

- ✓ **Given** a batch completes its final configured stage, **when** the last stage is marked complete, **then** the batch status automatically updates to Processing Complete.
- ✓ **Given** a stage runs beyond the configured duration threshold, **when** the threshold is crossed, **then** the Branch Manager is notified with the batch and stage identified.

---

### SRS-LDY-B-03: Machine and Resource Allocation

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Laundry Attendant | Release 2 | v1.0 baseline |

> *As a Laundry Attendant, I want the system to stop me double-booking a machine, so I don't accidentally start two loads on the same washer.*

**Requirements**

- LDY maintains a register of machines/stations (washers, dryers, presses) with a status of Available, In Use, or Under Maintenance.
- Assigning a batch to a machine sets it to In Use for the batch's duration; completing or cancelling the batch's stage on that machine returns it to Available.
- A System Administrator or Branch Manager can mark a machine Under Maintenance, removing it from assignment until cleared.
- Machine utilisation (time in use vs. available) is tracked for reporting (SRS-LDY-F-01).

**Validation Rules**

- A batch cannot be assigned to a machine that is In Use or Under Maintenance.

**Workflow**

1. Attendant selects an Available machine for a batch's stage
2. Machine set to In Use
3. Stage completes
4. Machine returns to Available
5. Utilisation logged.

**Error States**

| Error | Message shown to the user |
|---|---|
| Machine Unavailable | *“This machine is currently in use or under maintenance and cannot be assigned.”* |

**Acceptance Criteria**

- ✓ **Given** a machine is Available, **when** a batch is assigned to it, **then** the machine's status updates to In Use immediately.
- ✓ **Given** a machine is Under Maintenance, **when** an attendant attempts to assign a batch to it, **then** the action is blocked.

---

### SRS-LDY-B-04: Reprocessing and Rework Handling

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Laundry Attendant performing quality control | Release 2 | v1.0 baseline |

> *As a Laundry Attendant performing quality control, I want to send an item back for a rewash without losing track of it, so a rework never accidentally becomes a lost item.*

**Requirements**

- A Laundry Attendant can flag an item for rework, selecting the stage it needs to re-enter and a reason.
- The item is added to a new or existing batch for that stage; its original processing record is retained and the rework is linked to it, not overwritten.
- Rework count per item is tracked; an item reworked more than a configured number of times is flagged for Branch Manager review rather than sent through indefinitely.
- Rework does not change the item's original tag number or order linkage.

**Validation Rules**

- A rework cannot be logged without a reason selected or entered.

**Workflow**

1. Laundry Attendant flags an item for rework with a reason
2. Item routed to the appropriate stage's batch
3. Reprocessed
4. Re-inspected
5. Rework count incremented
6. Excessive reworks flagged for Branch Manager.

**Error States**

| Error | Message shown to the user |
|---|---|
| Missing Rework Reason | *“A reason is required before this item can be sent for rework.”* |

**Acceptance Criteria**

- ✓ **Given** an item is flagged for rework, **when** it's re-entered into processing, **then** its original processing history remains visible alongside the new rework entry.
- ✓ **Given** an item is reworked beyond the configured limit, **when** the limit is crossed, **then** it's flagged for Branch Manager review instead of being reprocessed again automatically.

## 3.3 Module C — Quality Check & Packaging

**Requirement summary (LDY-FR-C)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| C-01 | LDY must let a Laundry Attendant inspect each item (or a sampled subset per batch) after processing and record a Pass, Fail, or Rework outcome. | An item cannot proceed to packaging until it has a recorded QC outcome of Pass. | **MUST** |
| C-02 | LDY must let staff record damage discovered during processing or QC, compare it against intake condition, and trigger a customer notification workflow. | A damage report references the item's intake photo/notes (if any) so genuinely pre-existing damage is never misattributed to processing. | **MUST** |
| C-03 | LDY must let staff bundle an order's items together for handover once every item has passed QC, generating a packaging manifest. | An order cannot be packaged until every one of its items has a Pass QC outcome (or a recorded override/exception). | **MUST** |

---

### SRS-LDY-C-01: Quality Control Inspection

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Laundry Attendant performing quality control | Release 1 (MVP) | v1.0 baseline |

> *As a Laundry Attendant performing quality control, I want to record a clear pass/fail per item, so only items that actually meet standard reach the customer.*

**Requirements**

- LDY lets a Laundry Attendant scan an item and record an outcome: Pass, Fail (with reason), or Send for Rework (SRS-LDY-B-04).
- QC configuration determines whether every item is inspected or a sampled percentage per batch, set by the Branch Manager.
- A Fail outcome requires a reason and blocks the item from packaging until resolved (rework, discard with customer notification, or manager override with reason).
- QC outcomes and timestamps are recorded against the item for traceability.
- When the Independent QC setting is enabled (SRS-LDY-F-03), QC for an item must be recorded by a different Laundry Attendant from the one who completed its final processing stage; small branches can leave this setting off.

**Validation Rules**

- An item cannot move to Packaged status without a recorded Pass outcome (or a recorded manager override).

**Workflow**

1. Item completes processing
2. Laundry Attendant inspects (or batch is sampled)
3. Outcome recorded
4. Pass: item proceeds to packaging
5. Fail: routed to rework or resolution.

**Error States**

| Error | Message shown to the user |
|---|---|
| QC Not Passed | *“This item cannot be packaged: it has not recorded a Pass outcome from quality control.”* |

**Acceptance Criteria**

- ✓ **Given** an item passes QC, **when** the outcome is recorded, **then** the item's status updates to ready for packaging in the same action.
- ✓ **Given** an item fails QC, **when** the outcome is recorded with a reason, **then** it cannot proceed to packaging until rework or an override is recorded.

---

### SRS-LDY-C-02: Damage and Loss Reporting

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Branch Manager | Release 1 (MVP) | v1.0 baseline |

> *As a Branch Manager, I want damage clearly distinguished from pre-existing condition, so disputes with customers are resolved with evidence, not guesswork.*

**Requirements**

- A Laundry Attendant can report damage or loss discovered on an item, with a description and optional photo.
- The report is shown alongside any pre-existing damage/stain flag recorded at intake (SRS-LDY-A-04) for comparison.
- A damage or loss report triggers a notification to the Branch Manager and queues a customer notification for review before sending.
- The Branch Manager records a resolution (compensation, discount, replacement, or no fault found) which is logged against the order; a lost item is reported the same way with “Lost” as the report type.

**Validation Rules**

- A damage report cannot be closed without a recorded resolution.

**Workflow**

1. Staff reports damage/loss
2. Compared against intake record
3. Branch Manager notified
4. Customer notification queued for review
5. Resolution recorded
6. Report closed.

**Error States**

| Error | Message shown to the user |
|---|---|
| Resolution Required | *“This damage report cannot be closed without a recorded resolution.”* |

**Acceptance Criteria**

- ✓ **Given** an item has a pre-existing damage flag from intake, **when** a new damage report is filed, **then** the intake flag is shown alongside it for comparison.
- ✓ **Given** a Branch Manager records a resolution, **when** it's saved, **then** the report is closed and linked to the order's history.

---

### SRS-LDY-C-03: Packaging and Bundling

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Laundry Attendant | Release 1 (MVP) | v1.0 baseline |

> *As a Laundry Attendant, I want a packaging manifest that confirms every item is accounted for, so an order never goes out short a piece.*

**Requirements**

- Once every item in an order has passed QC (or has a recorded exception), a Laundry Attendant can bundle them for handover, generating a packaging manifest listing every tag number in the order.
- The manifest is checked off item by item during packaging; a missing item blocks the order from being marked Packaged.
- The order status updates to Packaged once the manifest is fully checked off.
- A packaged order is held in a designated ready-for-handover area, tracked by location/shelf reference.

**Validation Rules**

- An order cannot be marked Packaged with any manifest line item unchecked.

**Workflow**

1. All items pass QC
2. Packaging manifest generated
3. Items physically bundled and checked off
4. Manifest complete
5. Order status set to Packaged
6. Shelf/location recorded.

**Error States**

| Error | Message shown to the user |
|---|---|
| Incomplete Manifest | *“This order cannot be marked Packaged: one or more items on the manifest are not yet checked off.”* |

**Acceptance Criteria**

- ✓ **Given** every item in an order's manifest is checked off, **when** the last one is checked, **then** the order automatically updates to Packaged status.
- ✓ **Given** an item is missing from the manifest check-off, **when** packaging is attempted to be finalised, **then** it is blocked with the missing item identified.

## 3.4 Module D — Pickup, Delivery & Order Fulfilment

**Requirement summary (LDY-FR-D)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| D-01 | LDY must automatically notify the customer when their order reaches Packaged status, and let Front Desk confirm handover on pickup. | A pickup notification is sent exactly once per order automatically when it reaches Packaged status. | **MUST** |
| D-02 | LDY must let staff schedule a packaged order for delivery, assign it to a Delivery Rider, and track dispatch through completion. | An order cannot be dispatched to a rider whose current route is already at its configured capacity. | **MUST** |
| D-03 | LDY must let the Delivery Rider capture proof of delivery (signature or photo) at the point of handover, linked to the order. | An order cannot be marked Delivered without a recorded proof-of-delivery artifact. | **SHOULD** |
| D-04 | LDY must give the customer and Front Desk a real-time view of an order's status across the full journey, from intake to collection/delivery. | An order's status view reflects the latest processing, QC, and delivery events without a separate refresh step. | **MUST** |

---

### SRS-LDY-D-01: Ready-for-Pickup Notification

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Customer | Release 1 (MVP) | v1.0 baseline |

> *As a Customer, I want to be notified the moment my order is ready, so I don't have to call in to check.*

**Requirements**

- LDY sends an automatic notification (SMS/email/in-app) to the customer when an order reaches Packaged status, including the shelf/location reference for in-store pickup.
- At pickup, a Front Desk Officer scans the order or looks it up, confirms customer identity, and marks it Collected.
- Collection requires either full payment (SRS-LDY-E-02) or a recorded exception (e.g., corporate account on credit terms) before it can be finalised.
- An order not collected within a configured number of days after notification triggers automatic reminders at configured intervals and is flagged for Branch Manager follow-up.
- After the configured unclaimed-items period (stated on the customer's receipt), a Branch Manager may mark an order Unclaimed – Disposed with a reason; the decision is logged and the order is closed.

**Validation Rules**

- An order cannot be marked Collected while outstanding payment exists, unless a credit-account exception applies.

**Workflow**

1. Order reaches Packaged
2. Customer notified automatically
3. Customer arrives
4. Front Desk confirms identity and payment
5. Order marked Collected
6. Uncollected past threshold flagged for follow-up.

**Error States**

| Error | Message shown to the user |
|---|---|
| Payment Outstanding | *“This order cannot be marked Collected: payment is still outstanding. Process payment first, or apply a recorded credit exception.”* |

**Acceptance Criteria**

- ✓ **Given** an order reaches Packaged status, **when** the status changes, **then** the customer receives a pickup notification automatically in the same action.
- ✓ **Given** a customer arrives to collect an order with outstanding payment and no credit exception, **when** collection is attempted, **then** it is blocked until payment is processed.

---

### SRS-LDY-D-02: Delivery Scheduling and Dispatch

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Branch Manager | Release 1 (MVP) | v1.0 baseline |

> *As a Branch Manager, I want deliveries batched sensibly by route, so a rider isn't sent out with one order at a time when three are going to the same neighbourhood.*

**Requirements**

- For orders flagged for delivery at intake, LDY lets a Front Desk Officer or Branch Manager schedule a delivery window and assign the order to a delivery route.
- A Delivery Rider is assigned to a route carrying one or more orders, up to a configured maximum orders-per-route capacity.
- The order status updates to Out for Delivery when the rider departs, and the rider marks each order Delivered or Delivery Failed (with reason) as they complete the route.
- A failed delivery returns the order to the ready-for-handover queue for rescheduling.

**Validation Rules**

- An order cannot be added to a route that is already at its configured capacity.

**Workflow**

1. Packaged order flagged for delivery
2. Scheduled onto a route within capacity
3. Rider assigned
4. Route departs, order set Out for Delivery
5. Rider marks Delivered or Delivery Failed
6. Failed orders rescheduled.

**Error States**

| Error | Message shown to the user |
|---|---|
| Route At Capacity | *“This route is already at its configured maximum number of orders. Assign this order to a different route or time window.”* |

**Acceptance Criteria**

- ✓ **Given** a route is below its capacity, **when** an order is added, **then** it's assigned successfully and the route's order count updates.
- ✓ **Given** a delivery fails, **when** the rider records the failure with a reason, **then** the order returns to the ready-for-handover queue rather than remaining stuck as Out for Delivery.

---

### SRS-LDY-D-03: Proof of Delivery

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Branch Manager | Release 2 | v1.0 baseline |

> *As a Branch Manager, I want proof of delivery on file, so a “we never received it” dispute can be resolved quickly.*

**Requirements**

- At handover, the Delivery Rider captures a proof of delivery: recipient name, signature or photo, and timestamp, via the delivery portal/app.
- The proof of delivery is linked permanently to the order and viewable by Front Desk, Branch Manager, and the customer via self-service.
- If the intended recipient is unavailable, the rider records a Delivery Failed outcome instead (SRS-LDY-D-02), which does not require proof of delivery.

**Validation Rules**

- A Delivered outcome cannot be saved without either a signature or a photo captured.

**Workflow**

1. Rider reaches delivery location
2. Recipient available: captures proof of delivery, order marked Delivered
3. Recipient unavailable: records Delivery Failed instead.

**Error States**

| Error | Message shown to the user |
|---|---|
| Proof of Delivery Required | *“A signature or photo is required before this order can be marked Delivered.”* |

**Acceptance Criteria**

- ✓ **Given** a rider captures a signature at handover, **when** the delivery is recorded, **then** the order is marked Delivered and the signature is linked to the order record.
- ✓ **Given** a rider attempts to mark an order Delivered with no signature or photo captured, **when** they submit, **then** the action is blocked.

---

### SRS-LDY-D-04: Order Fulfilment Status Tracking

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Customer | Release 1 (MVP) | v1.0 baseline |

> *As a Customer, I want to check my order status online at any time, so I don't have to call the branch to ask.*

**Requirements**

- LDY displays an order's current status (Draft, Received, In Sorting, In Processing, QC, Packaged, Ready for Pickup/Out for Delivery, Collected/Delivered) and a chronological history with timestamps.
- The customer can view their own order's status via self-service using their order number or phone number; Front Desk and Branch Manager can view any order.
- Status updates automatically as items move through sorting, processing, QC, and fulfilment, with no manual status-setting step for these transitions.

**Validation Rules**

- Status transitions follow a fixed, enforced sequence; an order cannot move to Packaged without every item first passing QC.

**Workflow**

1. Order status changes as a side effect of intake, processing, QC, or fulfilment events
2. Change logged with actor and timestamp
3. Status visible immediately to customer and staff.

**Acceptance Criteria**

- ✓ **Given** a customer looks up their order by order number, **when** the page loads, **then** the current status and full history are shown without needing staff assistance.
- ✓ **Given** an item completes QC, **when** the outcome is recorded, **then** the order's overall status reflects it immediately without a manual sync step.

## 3.5 Module E — Billing & Payment

**Requirement summary (LDY-FR-E)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| E-01 | LDY must let a Branch Manager or Administrator configure pricing per service type and item category, including any rush/express surcharge. | An order's price cannot be calculated using a service type/item combination that has no configured price. | **MUST** |
| E-02 | LDY must generate an invoice for an order automatically at finalisation and let Front Desk capture payment by cash, card, or mobile money. | An order's invoice total always matches the sum of its priced line items plus any surcharge, recalculated automatically if items change before finalisation. | **MUST** |
| E-03 | LDY must let a Branch Manager record a refund or price adjustment against an order, with a mandatory reason. | A refund cannot exceed the amount actually paid on the order. | **SHOULD** |
| E-04 | LDY must support a corporate/business customer account billed on credit terms rather than paid per order. | An order on a corporate account can be collected without individual payment, but still appears on that account's outstanding balance. | **COULD** |
| E-05 | LDY must let a Front Desk Officer close the day's till by recording counted cash and non-cash totals against the system's expected totals. | A cash-up with a variance above the configured tolerance is flagged for Branch Manager review and cannot be marked Reconciled by the officer who closed it. | **SHOULD** |

---

### SRS-LDY-E-01: Pricing Configuration

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Branch Manager | Release 1 (MVP) | v1.0 baseline |

> *As a Branch Manager, I want pricing configured centrally, so Front Desk staff never quote inconsistent prices.*

**Requirements**

- A Branch Manager or Administrator configures a price list: item category x service type combinations, each with a base price.
- A configurable rush/express surcharge (percentage or fixed) can be applied when a customer selects expedited turnaround at intake.
- Price list changes apply to orders created after the change; an order already in progress keeps the price quoted at intake.
- Bulk/weight-based pricing (e.g., price per kg for wash-and-fold) is supported as an alternative to per-item pricing, configurable per service type.

**Validation Rules**

- An order line item cannot be priced if its category/service-type combination has no configured price; it is flagged rather than silently priced at zero.

**Workflow**

1. Manager/Administrator configures or updates the price list
2. Change validated
3. Change saved
4. Applies to new orders from that point; existing orders unaffected.

**Error States**

| Error | Message shown to the user |
|---|---|
| No Price Configured | *“This item category and service type combination has no configured price. Configure a price before this item can be added to an order.”* |

**Acceptance Criteria**

- ✓ **Given** a price list entry exists for an item/service combination, **when** it's added to an order, **then** the line item is priced automatically.
- ✓ **Given** no price is configured for a combination, **when** an attempt is made to add it to an order, **then** it is flagged rather than defaulting to zero.

---

### SRS-LDY-E-02: Invoice Generation and Payment Capture

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Front Desk Officer | Release 1 (MVP) | v1.0 baseline |

> *As a Front Desk Officer, I want the invoice generated automatically from the order, so I never have to manually total up a customer's items.*

**Requirements**

- LDY generates an invoice automatically when an order is finalised at intake, itemising each line, any surcharge, and the total due.
- Payment can be captured at intake (pay on drop-off), at pickup/delivery (pay on collection), or split between the two, per the branch's configured policy.
- Supported payment methods (cash, card, mobile money) are recorded per transaction with a reference number for non-cash methods.
- A partial payment is tracked as an outstanding balance against the order until fully settled.
- Invoices and receipts show the business name and tax identification number, any configured taxes or levies as separate lines, and the terms of service (liability limit for damage or loss and the unclaimed-items period). A receipt is issued for every payment, printed or sent by SMS/email.

**Validation Rules**

- The invoice total is recalculated automatically if line items change before the order leaves Draft status; it cannot be edited directly once finalised.

**Workflow**

1. Order finalised
2. Invoice generated automatically
3. Payment captured (full, partial, or deferred to collection)
4. Outstanding balance tracked if partial
5. Order marked fully paid once balance reaches zero.

**Error States**

| Error | Message shown to the user |
|---|---|
| Payment Reference Required | *“A reference number is required for card or mobile money payments before this transaction can be recorded.”* |

**Acceptance Criteria**

- ✓ **Given** an order is finalised, **when** finalisation completes, **then** an invoice is generated automatically reflecting every line item and surcharge.
- ✓ **Given** a customer pays the full amount at intake, **when** payment is recorded, **then** the order's outstanding balance is zero and this is reflected immediately.

---

### SRS-LDY-E-03: Refunds and Price Adjustments

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Branch Manager | Release 2 | v1.0 baseline |

> *As a Branch Manager, I want a controlled way to issue a refund, so compensation for a damaged item is properly recorded rather than handled informally.*

**Requirements**

- A Branch Manager can record a refund (full or partial) or a price adjustment against an order, with a reason and, where applicable, a link to a damage report (SRS-LDY-C-02).
- A Front Desk Officer cannot authorise a refund independently; it requires Branch Manager approval, preserving segregation of duties.
- The refunded or adjusted amount is reflected in the order's payment history and in revenue reporting (SRS-LDY-F-01).
- The refund is recorded against the original payment method where the method supports it; cash refunds are recorded as a cash-out transaction.
- Every refund and adjustment appears on the daily cash-up report (SRS-LDY-E-05) so that the owner or a second manager can review refunds after the fact.

**Validation Rules**

- A refund amount cannot exceed the total amount actually paid on the order.

**Workflow**

1. Branch Manager reviews the order (often prompted by a damage report)
2. Records a refund or adjustment with reason
3. Amount validated against amount paid
4. Refund recorded and reflected in payment history and reporting.

**Error States**

| Error | Message shown to the user |
|---|---|
| Refund Exceeds Payment | *“This refund amount exceeds what was actually paid on this order and cannot be processed.”* |

**Acceptance Criteria**

- ✓ **Given** a damage report is resolved with a compensation decision, **when** the Branch Manager records the refund, **then** it is linked to the damage report and reflected in the order's payment history.
- ✓ **Given** a Front Desk Officer attempts to record a refund directly, **when** they try, **then** the action is blocked and routed to a Branch Manager instead.

---

### SRS-LDY-E-04: Corporate Accounts and Credit Terms

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **COULD** | Branch Manager | Backlog | v1.0 baseline |

> *As a Branch Manager, I want to offer corporate customers monthly billing, so regular high-volume clients don't have to pay per drop-off.*

**Requirements**

- A Branch Manager or Administrator can configure a customer profile as a Corporate Account with agreed credit terms (e.g., net-30) and a credit limit.
- Orders placed against a corporate account are not individually invoiced for immediate payment; they accumulate on the account's running balance.
- A Front Desk Officer or Branch Manager generates a consolidated statement for a corporate account at the end of its billing cycle, covering every order placed in the period.
- An order cannot be placed against a corporate account whose running balance would exceed its configured credit limit, without a Branch Manager override.

**Validation Rules**

- A corporate account's running balance cannot exceed its credit limit without a recorded Branch Manager override and reason.

**Workflow**

1. Order placed against corporate account
2. Running balance checked against credit limit
3. Within limit: order proceeds, balance updated
4. Billing cycle ends: consolidated statement generated
5. Payment received against statement, balance reduced.

**Error States**

| Error | Message shown to the user |
|---|---|
| Credit Limit Exceeded | *“This order would exceed the corporate account's credit limit. A Branch Manager override is required to proceed.”* |

**Acceptance Criteria**

- ✓ **Given** a corporate account order is placed for a customer within their credit limit, **when** the order is finalised, **then** it proceeds without individual payment and the account's balance updates.
- ✓ **Given** a corporate account's billing cycle ends, **when** the statement is generated, **then** it lists every order placed in the period with a total amount due.

---

### SRS-LDY-E-05: Daily Cash-Up & Till Reconciliation

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Branch Manager | Release 2 | **New in v2.0** |

> *As a Branch Manager, I want every shift to end with a till reconciliation, so that cash differences and unusual refunds are spotted the same day instead of at month-end.*

**Requirements**

- At the end of a shift or day, the Front Desk Officer opens a cash-up for their session; LDY shows the expected totals per payment method (payments received minus refunds paid) for that session.
- The officer records counted cash and the totals shown on card and mobile-money statements; LDY calculates the variance per method.
- A variance within the configured tolerance is recorded as Balanced; a larger variance is flagged for the Branch Manager, who records an explanation and marks the cash-up Reconciled.
- The daily cash-up report lists all payments, refunds, adjustments, and variances for the day, and is available to the Branch Manager and Auditor.

**Validation Rules**

- A cash-up cannot be closed while any payment captured during the session is still unsaved or pending a payment reference.

**Workflow**

1. Front Desk Officer starts cash-up
2. Expected totals shown
3. Counted totals entered
4. Variance calculated
5. Within tolerance: Balanced
6. Above tolerance: flagged to Branch Manager
7. Explanation recorded
8. Reconciled.

**Error States**

| Error | Message shown to the user |
|---|---|
| Variance Requires Review | *“The counted amount differs from the expected amount by {amount}. This cash-up has been sent to the Branch Manager for review.”* |

**Acceptance Criteria**

- ✓ **Given** counted cash equals the expected cash total, **when** the cash-up is submitted, **then** it is recorded as Balanced with no manager action required.
- ✓ **Given** the variance exceeds the tolerance, **when** the Front Desk Officer submits the cash-up, **then** it is flagged for the Branch Manager and the officer cannot mark it Reconciled themselves.

## 3.6 Module F — Reporting, Audit & Configuration

**Requirement summary (LDY-FR-F)**

| ID | Requirement | Key Acceptance Criterion | Priority |
|---|---|---|---|
| F-01 | LDY must provide role-based dashboards (turnaround time, revenue, machine utilisation, delivery performance) and exportable reports. | A report export completes within a defined time for a reasonable date range without blocking the user's session. | **SHOULD** |
| F-02 | LDY must log every order status transition, QC outcome, payment, refund, and configuration change as an immutable, timestamped record. | No audit record can be edited or deleted through the application, only appended to. | **MUST** |
| F-03 | LDY must let the System Administrator configure pricing, turnaround SLAs, batching rules, the machine register, and roles without a code deployment. | A configuration change takes effect for new orders immediately, without affecting orders already in progress. | **MUST** |
| F-04 | LDY must let the System Administrator create, deactivate, and assign roles to user accounts, and must provide secure sign-in, password reset, and account lockout. | A deactivated user cannot sign in, and every role assignment change is written to the audit trail. | **MUST** |
| F-05 | LDY must send notifications through configurable channels (in-app, email, SMS) using editable templates, and keep a delivery log. | Every notification attempt is logged with its channel, recipient, and delivery status; a failed send is retried automatically. | **SHOULD** |
| F-06 | LDY must let the System Administrator import opening data from CSV templates with validation before commit. | No row from an import file is committed unless the whole file passes validation, or the administrator explicitly commits only the valid rows. | **SHOULD** |

---

### SRS-LDY-F-01: Dashboards and Reporting

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | Branch Manager | Release 2 | v1.0 baseline |

> *As a Branch Manager, I want a dashboard of turnaround time and revenue, so I can see where the operation is slow or underperforming without pulling data manually.*

**Requirements**

- LDY provides role-scoped dashboards: Customers see their own order history; Front Desk staff see daily intake and payment summaries; Branch Manager sees turnaround time, revenue, machine utilisation, and delivery performance; Auditors see the full transaction and approval trail read-only.
- Reports (revenue by period/service type, average turnaround time, machine utilisation, damage/refund rate) can be filtered by date range and exported to CSV/PDF.
- Dashboard figures refresh automatically as underlying orders change status; no manual “refresh data” job is required.

**Validation Rules**

- Exported reports respect the viewer's role scope — a customer's export never includes another customer's data.

**Workflow**

1. User opens dashboard for their role
2. LDY aggregates current data scoped to their access
3. User optionally filters by date range and exports
4. Export generated and downloadable.

**Acceptance Criteria**

- ✓ **Given** a Branch Manager opens the turnaround dashboard, **when** an order is marked Delivered, **then** the dashboard's average turnaround figure reflects it without requiring a page reload beyond the next normal refresh.
- ✓ **Given** a customer exports their order history, **when** the export is generated, **then** it contains only orders placed under their own profile.

---

### SRS-LDY-F-02: Immutable Audit Trail

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | Auditor | Release 1 (MVP) | v1.0 baseline |

> *As an Auditor, I want a complete, tamper-evident trail of every order and payment event, so revenue and refunds can be independently verified at any time.*

**Requirements**

- Every meaningful state change (order creation/finalisation, sorting/processing stage transitions, QC outcomes, damage reports, packaging, pickup/delivery events, payments, refunds, configuration changes) is written to an append-only audit log with actor, timestamp, and before/after values where applicable.
- Audit records are never updated or deleted through the application; corrections are made by new, linked entries, never by altering history.
- The Auditor/Viewer role has read-only access to the full audit trail across all orders, independent of their own operational scope.

**Validation Rules**

- The audit trail for any order can be reconstructed end-to-end from its own record alone, without cross-referencing other tables manually.

**Workflow**

1. Any tracked action occurs
2. Audit event written with actor, timestamp, and change detail
3. Event becomes immutable
4. Visible to Auditor/Viewer and to the order's own history view.

**Error States**

| Error | Message shown to the user |
|---|---|
| Edit Blocked — Immutable Record | *“Audit records cannot be edited or deleted. To correct an error, make a new entry referencing the original.”* |

**Acceptance Criteria**

- ✓ **Given** any user with database-level access attempts to alter a past audit entry through the application, **when** the attempt is made, **then** it is blocked at the application layer with no route to edit history.
- ✓ **Given** an Auditor opens an order's history, **when** they view it, **then** every transition from Draft through to Collected/Delivered is shown with actor and timestamp, with no gaps.

---

### SRS-LDY-F-03: System Configuration

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | System Administrator | Release 1 (MVP) | v1.0 baseline |

> *As a System Administrator, I want to adjust turnaround SLAs and pricing from a settings screen, so policy changes don't require a developer to redeploy the system.*

**Requirements**

- The System Administrator configures, via an admin settings screen: price list entries, turnaround SLA per service type, batching/compatibility rules, the machine/station register, rework limits, the Independent QC setting, unclaimed-items periods, taxes and levies, receipt terms, and cash-up variance tolerance.
- Configuration changes apply to new orders and batches from the point of the change onward; orders already in progress continue under the rules in effect when they started.
- Role and permission assignments (who can hold which of the seven LDY roles) are managed from the same settings area.
- Every configuration change is written to the audit trail (SRS-LDY-F-02) with the prior and new value.

**Validation Rules**

- A configuration change cannot leave a price or SLA value blank or negative.

**Workflow**

1. System Administrator opens settings
2. Adjusts a price, SLA, rule, or role assignment
3. Change validated
4. Change saved and takes effect immediately for new transactions
5. Audit event logged with prior and new value.

**Error States**

| Error | Message shown to the user |
|---|---|
| Invalid Configuration Value | *“This value must be a positive number. The change has not been saved.”* |

**Acceptance Criteria**

- ✓ **Given** a System Administrator changes the turnaround SLA for a service type, **when** the change is saved, **then** it applies to orders created afterward but does not alter the expected ready-by date of orders already in progress.
- ✓ **Given** a System Administrator attempts to save a negative price, **when** they submit, **then** the save is blocked with a validation message and the previous value remains in effect.

---

### SRS-LDY-F-04: User Account & Access Management

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **MUST** | System Administrator | Release 1 (MVP) | **New in v2.0** |

> *As a System Administrator, I want to manage user accounts and role assignments in one place, so that access always matches each person's current job and nobody keeps access they no longer need.*

**Requirements**

- The System Administrator creates a user account (name, email and/or phone, status) and assigns one or more roles from the role model in section 2.3; a user may hold several roles subject to the segregation-of-duties rules in section 2.4.
- Users sign in with a unique username (email or phone) and password; a forgotten password is reset through a time-limited, single-use link or one-time code sent to the registered email or phone.
- After a configured number of consecutive failed sign-in attempts, the account is locked for a configured period; the System Administrator can unlock it early. Privileged roles (Branch Manager, System Administrator) should support multi-factor authentication.
- Deactivating a user ends all of their active sessions immediately; the account and its history are retained for audit and are never hard-deleted.
- When a role is assigned that forms a segregation-of-duties pair with a role the user already holds (section 2.4), the system shows a warning and records the justification; transaction-level SoD blocks still apply regardless of role combination.

**Validation Rules**

- A user account cannot be saved without a unique username, and at least one System Administrator account must always remain Active.

**Workflow**

1. System Administrator creates or edits a user
2. Assigns role(s)
3. SoD pair check runs
4. Warning acknowledged with justification (if applicable)
5. Account saved and credentials issued
6. Change written to the audit trail.

**Error States**

| Error | Message shown to the user |
|---|---|
| Last Administrator | *“This account cannot be deactivated or have the Administrator role removed: at least one active System Administrator is required.”* |
| Account Locked | *“Too many unsuccessful sign-in attempts. Your account is locked for {minutes} minutes. Contact your System Administrator if you need access sooner.”* |

**Acceptance Criteria**

- ✓ **Given** a user enters an incorrect password more times than the configured limit, **when** the next attempt is made, **then** the account is locked and the attempt is refused even with the correct password.
- ✓ **Given** a System Administrator deactivates a user who is currently signed in, **when** the change is saved, **then** that user's session ends and their next request is refused.

---

### SRS-LDY-F-05: Notification Management

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | System Administrator | Release 2 | **New in v2.0** |

> *As a System Administrator, I want to control notification wording and channels without a code change, so that messages sound like our organisation and reach people on the channel they actually use.*

**Requirements**

- Every notification referenced in this SRS is generated from a named template with placeholders (e.g., {name}, {reference}, {amount}); the System Administrator can edit template wording and enable or disable each channel per template.
- Notifications are queued and sent asynchronously so that the user action that triggered them is never delayed by the email or SMS provider.
- Each send attempt is written to a delivery log (template, channel, recipient, timestamp, status); failed sends are retried a configured number of times before being marked Failed.
- Recipients can opt out of non-essential (marketing or reminder) messages; transactional and security messages (e.g., password reset) cannot be switched off.

**Validation Rules**

- A template cannot be saved if it references a placeholder that the triggering event does not provide.

**Workflow**

1. Triggering event occurs
2. Template selected
3. Placeholders filled
4. Message queued per enabled channel
5. Send attempted
6. Result written to delivery log
7. Retries on failure.

**Error States**

| Error | Message shown to the user |
|---|---|
| Unknown Placeholder | *“This template uses a placeholder that is not available for this event. Remove or correct {placeholder} before saving.”* |

**Acceptance Criteria**

- ✓ **Given** the SMS provider is unavailable, **when** a notification is triggered, **then** the originating user action still completes and the message is retried and logged.
- ✓ **Given** an administrator edits a template's wording, **when** the next matching event occurs, **then** the new wording is used without a deployment.

---

### SRS-LDY-F-06: Bulk Data Import for Go-Live

| Priority | Primary actor | Release | Origin |
|---|---|---|---|
| **SHOULD** | System Administrator onboarding a new client | Release 2 | **New in v2.0** |

> *As a System Administrator onboarding a new client, I want to load existing records from a spreadsheet, so that go-live does not depend on staff retyping hundreds of records by hand.*

**Requirements**

- The system provides downloadable CSV templates for the main master data: customers (including corporate accounts), the price list, and the machine/station register.
- An uploaded file is validated in full (mandatory fields, formats, duplicates, references to existing records) before anything is saved, and a row-by-row validation report is shown.
- The administrator either fixes the file and re-uploads it, or commits only the rows that passed; every import is recorded with its file name, row counts, and the user who ran it.
- Imported records are created in the same states and through the same validation rules as records created in the user interface; imports cannot bypass approvals that apply to live transactions.

**Validation Rules**

- An import cannot create a record that would fail the validation rules of the equivalent manual entry screen.

**Workflow**

1. Administrator downloads template
2. Fills and uploads CSV
3. Full validation runs
4. Report shown
5. Administrator commits all (if clean) or valid rows only
6. Import logged in the audit trail.

**Error States**

| Error | Message shown to the user |
|---|---|
| Import Validation Failed | *“{count} row(s) failed validation. Download the report to see each error, or commit only the {valid} valid row(s).”* |

**Acceptance Criteria**

- ✓ **Given** an uploaded file contains one row with a duplicate identifier, **when** validation runs, **then** that row is reported with the reason and nothing is committed until the administrator chooses how to proceed.
- ✓ **Given** a file passes validation, **when** the administrator commits it, **then** every row is created and the import is visible in the audit trail with its row count.

# 4. External Interface Requirements

## 4.1 User Interfaces

A responsive web application. The Front Desk and Laundry Attendant screens are optimised for fast, scan-driven entry on a desktop or tablet with large touch targets; the Delivery Rider and Customer screens are optimised for mobile phones.

- Every screen shows the signed-in user, their active role, and only the actions that role may perform.
- Validation messages appear next to the field concerned and use the wording in each requirement's Error States.
- Lists support search, filter, sort, and pagination; every record shows its status and a link to its history.
- Monetary values show the configured currency; dates and times use the configured format and time zone (section 6.7).

## 4.2 Hardware Interfaces

Thermal label printer for item tags (e.g., 58 mm or 80 mm, USB or Bluetooth); barcode/QR scanner acting as a keyboard (USB HID) or the device camera; optional receipt printer; the rider's Android phone camera for proof-of-delivery photos and signatures. All can be simulated in the intern build.

## 4.3 Software Interfaces

| External system | Direction | Purpose and intern-build treatment |
|---|---|---|
| Mobile money / card payments | Outbound + callback | Payment capture with reference (SRS-LDY-E-02). Stubbed in the intern build. |
| SMS / email gateway | Outbound | Customer and staff notifications (SRS-LDY-F-05). Stubbed in the intern build. |
| Accounting package | Outbound (file) | Daily sales, refunds and cash-up export as CSV (SRS-LDY-F-01) for the client's bookkeeping. |

## 4.4 Communications Interfaces

All client–server traffic uses HTTPS (TLS 1.2 or higher). Payment and SMS providers are reached over their HTTPS APIs; payment callbacks are verified by signature before a payment is marked settled.

# 5. Data Requirements

## 5.1 Key Data Entities

| Entity | Key attributes |
|---|---|
| Customer | customer_id, name, phone, email, address, standing_preferences, account_type (Individual/Corporate), created_at. |
| Order | order_id, customer_id, status, line items, expected_ready_by, delivery_flag, delivery_address, cancellation_reason, created_at. |
| Order Item / Tag | tag_id, order_id, category, service_type, special_instructions, flags, current_stage, status. |
| Batch | batch_id, service_type, machine_id, attendant_id, stage, started_at, completed_at. |
| QC Outcome | qc_id, tag_id, outcome (Pass/Fail/Rework), reason, inspected_by, timestamp. |
| Damage / Loss Report | report_id, tag_id, order_id, description, photo_ref, resolution, resolved_by, status. |
| Delivery Route | route_id, rider_id, scheduled_date, orders (list), capacity. |
| Proof of Delivery | pod_id, order_id, recipient_name, signature/photo_ref, timestamp. |
| Invoice / Payment | invoice_id, order_id, line items, surcharge, total, payments (method, amount, reference), outstanding_balance. |
| Refund / Adjustment | refund_id, order_id, amount, reason, linked_report_id, authorized_by, timestamp. |
| Corporate Account | account_id, customer_id, credit_limit, running_balance, billing_cycle, statement history. |
| Machine / Station | machine_id, type, status (Available/In Use/Under Maintenance), utilisation_log. |
| Audit Event (immutable) | event_id, entity_type, entity_id, actor_user_id, action, before_value, after_value, timestamp. |
| Configuration Entities (admin-managed) | PriceListEntry, SLAConfig, BatchingRule, ReworkLimitConfig, RolePermissionAssignment. |
| Cash-Up Session | session_id, officer_id, opened_at, closed_at, expected totals per method, counted totals per method, variance, status (Balanced/Flagged/Reconciled), reviewed_by. |
| Pickup Booking | booking_id, customer_id, service_type, address, slot, status, rider_id, linked_order_id. |
| User Account | user_id, name, username, email/phone, password_hash, mfa_enabled, status (Active/Locked/Deactivated), roles, last_sign_in_at. |
| Notification Log | notification_id, template, channel, recipient, reference entity, status (Queued/Sent/Failed), attempts, sent_at. |
| Import Batch | import_id, entity_type, file_name, rows_total, rows_committed, rows_rejected, run_by, run_at. |

## 5.2 Data Retention and Privacy

- Order, payment, and delivery records in the intern build are synthetic and may be purged at the end of the programme. A client deployment applies the organisation's standard commercial-records retention policy.
- Customer contact details and any intake/damage photos are treated as sensitive and access-restricted to Front Desk, Branch Manager, and Laundry Attendant staff as relevant to their role.
- Audit events are retained indefinitely (or per the organisation's audit policy) and are never purged by application-level actions.
- Access to personal data is limited to the purposes stated in this SRS; every export of personal data is logged (who, what, when), and a data subject's request to view or correct their data can be fulfilled from the system's own records.

## 5.3 Configuration Parameters and Suggested Defaults

Every value below is configurable (no code change). The defaults let the intern build run realistically; confirm each one with the programme supervisor or client before UAT.

| Parameter | Suggested default | Used in |
|---|---|---|
| Turnaround SLA | Standard 48 hours; Express 24 hours | SRS-LDY-A-02 |
| Express surcharge | 50% of line price | SRS-LDY-E-01 |
| Stage-duration alert threshold | 4 hours per stage | SRS-LDY-B-02 |
| Rework limit per item | 2 reworks, then Branch Manager review | SRS-LDY-B-04 |
| QC mode / Independent QC | Inspect 100% of items / Off | SRS-LDY-C-01 |
| Uncollected-order follow-up | Reminders at 7 and 14 days; manager flag at 14 days | SRS-LDY-D-01 |
| Unclaimed-items disposal period | 90 days after ready notification | SRS-LDY-D-01 |
| Delivery route capacity | 10 orders per route | SRS-LDY-D-02 |
| Corporate credit terms / default limit | Net 30 days / GHS 2,000 | SRS-LDY-E-04 |
| Cash-up variance tolerance | GHS 5 per payment method | SRS-LDY-E-05 |
| Session idle timeout | 15 minutes | NFR-SEC1 |
| Failed sign-in lockout | 5 attempts → 15-minute lock | SRS-LDY-F-04 |

# 6. Non-Functional Requirements

## 6.1 Security

- **NFR-SEC1:** All access is controlled via role-based access control (RBAC) enforcing the seven defined LDY roles with least privilege; authentication uses secure session tokens with a configurable idle timeout.
- **NFR-SEC2:** Segregation of duties is enforced at the application layer for refund authorisation vs. payment capture, per SRS-LDY-E-03; violations are blocked, not merely logged.
- **NFR-SEC3:** Customer contact details and payment references are encrypted at rest; all traffic uses TLS 1.2 or higher.
- **NFR-SEC4:** Passwords are stored only as salted hashes using a modern adaptive algorithm (Argon2 or bcrypt); minimum length 10 characters; accounts lock after a configurable number of failed attempts (default 5).
- **NFR-SEC5:** Authorisation is checked on the server for every request and every record; hiding a button or menu item in the user interface is never relied upon as a security control.
- **NFR-SEC6:** Before any client go-live, the application is checked against the OWASP Top 10 (and OWASP ASVS Level 1 as a target), with findings above Medium severity resolved.
- **NFR-SEC7:** Security events (sign-in success and failure, lockouts, password resets, role and permission changes, data exports) are logged and retained with the audit trail.

## 6.2 Performance

- **NFR-P1:** Order finalisation (tag generation and invoice creation) completes within 2 seconds under normal load.
- **NFR-P2:** A tag scan lookup at any processing stage returns the item's current record within 1 second.
- **NFR-P3:** Dashboard and report views load within 5 seconds for a reasonable date range and role scope; CSV/PDF export completes within 30 seconds.
- **NFR-P4:** The system supports at least 50 concurrent signed-in users on the reference deployment without breaching the response times above.

## 6.3 Reliability and Recovery

- **NFR-R1:** 99% uptime for the intern demo environment during the review period; 99.5% during business hours for a client production deployment, excluding announced maintenance.
- **NFR-R2:** Tag scanning is idempotent — scanning the same tag twice at the same stage does not create duplicate stage records.
- **NFR-R3:** A failed export or report generation can be retried without corrupting or duplicating underlying transaction data.
- **NFR-R4:** Production backups are encrypted, stored off the application server, and restore-tested at least quarterly. Recovery Point Objective (RPO) ≤ 24 hours; Recovery Time Objective (RTO) ≤ 8 hours.

## 6.4 Usability and Accessibility

- **NFR-U1:** The order intake and tag-scanning flows are usable by non-technical staff with minimal training, with inline validation messages that state exactly what is missing or wrong.
- **NFR-U2:** Role-based views show each user only the actions and data relevant to their role, reducing navigation complexity for Front Desk staff and Laundry Attendants in particular.
- **NFR-U3:** All screens are responsive and fully usable on a 360-pixel-wide mobile screen and on low-bandwidth (3G) connections; pages avoid unnecessary heavy assets.
- **NFR-U4:** The user interface targets WCAG 2.1 Level AA for contrast, keyboard navigation, form labels, and error identification.

## 6.5 Availability

- **NFR-AV1:** The system is available during standard branch operating hours; planned maintenance is scheduled outside those hours and announced at least 48 hours in advance.
- **NFR-AV2:** Scheduled backups of order, payment, and audit data are taken at least daily, in both the intern build and production.

## 6.6 Maintainability

- **NFR-M1:** Pricing, turnaround SLAs, batching rules, and rework limits are configuration-driven (SRS-LDY-F-03) and require no code deployment to change.
- **NFR-M2:** The codebase follows the project's shared coding standards and is structured so backend and frontend components can be developed, tested, and deployed independently by their respective team members.
- **NFR-M3:** Business rules (calculations, validations, state transitions) are covered by automated tests, with a target of at least 60% line coverage on the service layer; tests run on every merge.
- **NFR-M4:** The backend exposes a documented REST API (OpenAPI specification); database changes are applied through versioned migrations; secrets and environment settings are held outside the codebase.

## 6.7 Compatibility, Localisation and Compliance

- **NFR-C1:** Supported browsers are the two latest major versions of Chrome, Edge, Firefox, and Safari, plus Chrome on Android.
- **NFR-C2:** Currency, date format, time zone, and organisation details (name, logo, address, tax identification number) are configurable. Suggested defaults: GHS, DD/MM/YYYY, Africa/Accra (GMT).
- **NFR-C3:** All user-facing text is held in resource files (not hard-coded) so the interface can be translated without code changes; English is the default language.
- **NFR-C4:** Personal data is processed in line with the data protection law of the deployment country (for Ghana, the Data Protection Act, 2012 (Act 843)), including a lawful basis for processing, purpose limitation, and data subject access and correction on request.

## 6.8 Constraints and Project Team

- **Delivery timeline:** every MUST requirement (Release 1 — Modules A–E, plus the MUST items of Module F) must be functional and demonstrable by the programme's review/demo date. Owner: Intern Project Team 2.
- **No Live Payment Gateway:** this build records payments and refunds but does not integrate with a live card or mobile-money processor. Owner: Intern Project Team 2.
- **Mocked External Dependencies:** SMS notification and delivery-dispatch integrations may be stubbed or simulated for the intern build rather than connected to a live external provider. Owner: Intern Project Team 2.
- **Client tailoring:** before any client deployment, the configuration defaults (section 5.3), role assignments (sections 2.3–2.4), statutory or tax tables, and branding are confirmed with the client and recorded as a new version of this SRS. Owner: NOVA CREATE HUB delivery lead.
- **Technology:** the team may choose its own stack, provided it meets section 6 and the operating environment in section 2.6; the choice is recorded in the project README before development starts.

| Project role | Responsibility | Assigned to |
|---|---|---|
| Backend Developer(s) | Services, business rules, database, API | [Assign] |
| Frontend Developer(s) | Web and mobile-responsive user interface | [Assign] |
| UI/UX Designer | Wireframes, prototypes, usability checks (shared across intern teams) | [Assign] |
| Security Reviewer | Security review against section 6.1 before demo | [Assign] |
| Programme Supervisor | Scope decisions, configuration sign-off, UAT | [Assign] |

# Appendix A: Role–Permission Matrix

**C** = can perform / create   **A** = approves   **V** = view only   **—** = no access. Transaction-level segregation-of-duties rules in section 2.4 apply on top of this matrix.

| Action | Customer | Front Desk | Attendant | Rider | Branch Mgr | Sys Admin | Auditor |
|---|---|---|---|---|---|---|---|
| Register customer / create order | C¹ | C | — | — | C | — | V |
| Cancel order before processing | — | C | — | — | C | — | V |
| Sort, batch, record processing stages | — | — | C | — | C | — | V |
| Record QC outcome / report damage | — | — | C | — | C | — | V |
| Resolve damage report | — | — | — | — | A | — | V |
| Package order | — | — | C | — | C | — | V |
| Schedule delivery / assign rider | — | C | — | — | C | — | V |
| Record delivery outcome and proof | — | — | — | C | — | — | V |
| Capture payment / confirm pickup | — | C | — | — | C | — | V |
| Authorise refund / adjustment / override | — | — | — | — | A | — | V |
| Close daily cash-up | — | C | — | — | C | — | V |
| Reconcile cash-up variance | — | — | — | — | A | — | V |
| Track own order | V | — | — | — | — | — | — |
| Configure pricing, SLAs, rules, users | — | — | — | — | C² | C | V |
| View full audit trail | — | — | — | — | V | V | V |

*¹ Customer self-registration and online booking only; orders are finalised at the counter.*

*² Pricing and SLAs only.*

# Appendix B: Requirements Traceability Matrix

Use this matrix to track build and test status. Add columns for the owner, the test case reference, and the test result as the project progresses.

| Requirement | Title | Mod. | Priority | Release | Verify | v2.0 |
|---|---|---|---|---|---|---|
| SRS-LDY-A-01 | Customer Registration & Profile | A | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-A-02 | Order Creation & Item Cataloguing | A | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-A-03 | Intake Tagging & Item Tracking | A | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-A-04 | Special Instructions & Exception Flagging | A | **SHOULD** | Release 2 | Test | — |
| SRS-LDY-A-05 | Order Cancellation | A | **SHOULD** | Release 2 | Test | New |
| SRS-LDY-A-06 | Online Pickup / Drop-off Booking | A | **COULD** | Backlog | Test | New |
| SRS-LDY-B-01 | Sorting by Service Type and Batch Assignment | B | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-B-02 | Processing Stage Tracking (Wash / Dry / Iron) | B | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-B-03 | Machine and Resource Allocation | B | **SHOULD** | Release 2 | Test | — |
| SRS-LDY-B-04 | Reprocessing and Rework Handling | B | **SHOULD** | Release 2 | Test | — |
| SRS-LDY-C-01 | Quality Control Inspection | C | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-C-02 | Damage and Loss Reporting | C | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-C-03 | Packaging and Bundling | C | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-D-01 | Ready-for-Pickup Notification | D | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-D-02 | Delivery Scheduling and Dispatch | D | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-D-03 | Proof of Delivery | D | **SHOULD** | Release 2 | Test | — |
| SRS-LDY-D-04 | Order Fulfilment Status Tracking | D | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-E-01 | Pricing Configuration | E | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-E-02 | Invoice Generation and Payment Capture | E | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-E-03 | Refunds and Price Adjustments | E | **SHOULD** | Release 2 | Test | — |
| SRS-LDY-E-04 | Corporate Accounts and Credit Terms | E | **COULD** | Backlog | Test | — |
| SRS-LDY-E-05 | Daily Cash-Up & Till Reconciliation | E | **SHOULD** | Release 2 | Test | New |
| SRS-LDY-F-01 | Dashboards and Reporting | F | **SHOULD** | Release 2 | Demo + Test | — |
| SRS-LDY-F-02 | Immutable Audit Trail | F | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-F-03 | System Configuration | F | **MUST** | Release 1 (MVP) | Test | — |
| SRS-LDY-F-04 | User Account & Access Management | F | **MUST** | Release 1 (MVP) | Test | New |
| SRS-LDY-F-05 | Notification Management | F | **SHOULD** | Release 2 | Test | New |
| SRS-LDY-F-06 | Bulk Data Import for Go-Live | F | **SHOULD** | Release 2 | Test | New |

# Appendix C: Summary of Changes from Version 1.0

- Removed every reference to the previous programme owner and its internal programmes, systems, and house-style template; the document is now owned by the NOVA CREATE HUB Intern Development Programme.
- Replaced named individuals from the previous team allocation with a Project Team table of role placeholders (section 6.8), so the SRS can be reused for any intern cohort or client project.
- Replaced programme-specific go-live terminology with a neutral "Go-Live" definition covering both the intern build and client deployments.
- Added a cover page, document control fields, a working table of contents, an approval sign-off table, and neutral external references (ISO/IEC/IEEE 29148, OWASP, WCAG, data protection law).
- Added section 1.3 (audience and how to use), 1.4 (conventions: ID scheme, MoSCoW priorities, Given/When/Then), and merged the duplicated Appendix A glossary into section 1.5.
- Introduced a minimal role model (2.3), explicit segregation-of-duties rules and a small-organisation staffing guide (2.4), an operating environment (2.6), and delivery phasing (2.9).
- Added section 4 (External Interface Requirements), section 5.3 (configuration parameters with suggested defaults), and Appendices A (role–permission matrix) and B (traceability matrix).
- Added three platform requirements to Module F: User Account & Access Management, Notification Management, and Bulk Data Import for go-live.
- Rewrote internship-only statements (uptime, availability, backups, retention) so each states the intern-build target and the client-production target; added recovery objectives, password and authorisation controls, OWASP verification, accessibility, localisation, and data-protection compliance.
- Merged Quality Control Officer into Laundry Attendant and Cashier / Billing Officer into Front Desk Officer (9 roles → 6 core + 1 optional), with an optional Independent QC setting.
- Removed multi-branch wording that contradicted the single-branch scope.
- Added A-05 (Order Cancellation), A-06 (Online Pickup/Drop-off Booking, COULD), and E-05 (Daily Cash-Up & Till Reconciliation).
- Added unclaimed-order reminders and disposal, tax lines and terms on invoices and receipts, and after-the-fact refund review.
- Added Cancelled and Unclaimed – Disposed states to the status matrix.

*Laundry Management System · SRS v2.0 · NOVA CREATE HUB · Internal — training and client template*