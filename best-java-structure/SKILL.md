---
name: best-java-structure
description: Java Layered Architecture Design Pattern — A complete implementation guide for the classic five-layer architecture. Suitable for bootstrapping new Java projects, refactoring existing architectures, establishing team development standards, and database migration scenarios. Covers design principles, code examples, and best practices for the Presentation Layer, Business Logic Layer, Data Access Layer, Persistence Layer, and Database Layer.
---

# Java Layered Architecture Design Pattern
A complete guide to implementing a layered Java architecture, covering the design principles, code examples, and best practices for the Presentation Layer, Business Logic Layer, Data Access Layer, and Persistence Layer.
## When to Apply
Use this skill in the following scenarios:
- Creating a new Java Web project
- Refactoring an existing project architecture
- Designing a multi-module Java system
- Checking architectural compliance during code reviews
- Defining architectural standards for team development
- Database migration or technology stack migration
## Quick Reference
| Priority | Category | Impact Area | Prefix |
|---------:|----------|------------|--------|
| 1 | Separation of Concerns | Architectural clarity | -principle- |
| 2 | Unidirectional Dependency | Dependency management | -dependency- |
| 3 | Interface Abstraction | Replaceability | -abstraction- |
| 4 | Data Transfer | API consistency | -data- |
| 5 | Exception Handling | Error handling | -exception- |
| 6 | Cross-Layer Invocation | Architectural compliance | -crosslayer- |
| 7 | Reverse Dependency | Architectural compliance | -crosslayer- |
| 8 | Direct Entity Return | Security | -entity- |
## Core Principles
### 1. Separation of Concerns (SoC)
Each layer should solve one category of problems and must not take on responsibilities belonging to other layers.
```java
// ✅ Correct: Clear responsibilities per layer
// Presentation layer: HTTP handling only
@RestController
public class ProjectController {
    @GetMapping("/{id}")
    public ApiReturn<Project> getProject(@PathVariable Long id) {
        return ApiReturn.of(projectService.getProject(id));
    }
}
// Business logic layer: Business rules only
@Service
public class ProjectService {
    public Project getProject(Long id) {
        Project project = projectMapper.getById(id);
        if (project == null) {
            throw new BusinessException("Project does not exist");
        }
        return project;
    }
}
// Data access layer: Data interfaces only
public interface ProjectMapper {
    Project getById(Long id);
}
```
### 2. Unidirectional Dependency
Upper layers may call lower layers, but lower layers must not depend on upper layers.
```java
// ✅ Correct: Depend on the adjacent lower layer via abstraction
@Service
public class ProjectService {
    private ProjectMapper projectMapper;  // depends on an interface
}
// ❌ Incorrect: Cross-layer or reverse dependency
@RestController
public class ProjectController {
    private ProjectMapper projectMapper;  // cross-layer invocation
}
```
### 3. Interface Abstraction
Layers should interact via interfaces, not directly depend on concrete implementations.
```java
// ✅ Correct: Interface dependency
public class ProjectService {
    private ProjectMapper projectMapper;  // interface type
}
// ❌ Incorrect: Concrete class dependency
public class ProjectService {
    private ProjectMapperImpl projectMapperImpl;  // concrete class
}
```
## Architecture Layers
### Classic Five-Layer Architecture
```
Presentation Layer → Business Logic Layer → Data Access Layer → Persistence Layer → Database Layer
```
| Layer                    | Spring Stack         | Common Names            | Core Responsibilities                  |
| ------------------------ | -------------------- | ----------------------- | -------------------------------------- |
| **Presentation Layer**   | @Controller          | Controller, API         | Handle HTTP requests and responses     |
| **Business Logic Layer** | @Service             | Service, Manager        | Implement business rules and workflows |
| **Data Access Layer**    | @Mapper, @Repository | Mapper, Repository, DAO | Define data access interfaces          |
| **Persistence Layer**    | MyBatis XML, JPA     | Mapper XML, Entity      | Execute SQL and map results            |
| **Database Layer**       | MySQL, PostgreSQL    | Database                | Store and retrieve data                |
## Layer Definitions
### Presentation Layer
**Responsibilities**:
* Handle HTTP requests and responses
* Receive and validate parameters
* Routing and dispatching
* Data format transformation (DTO ↔ Entity)
* Exception handling and HTTP status mapping
**Template**:
```java
@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    @Resource
    private ProjectService projectService;
    @GetMapping("/{id}")
    public ApiReturn<ProjectVO> getProject(@PathVariable Long id) {
        // Parameter validation
        if (id == null || id <= 0) {
            return ApiReturn.error(400, "Invalid project ID");
        }
        // Call business logic layer
        Project project = projectService.getProject(id);
        // Entity -> VO
        ProjectVO vo = BeanUtils.copyProperties(project, ProjectVO.class);
        return ApiReturn.of(vo);
    }
    @PostMapping
    public ApiReturn<ProjectVO> createProject(@RequestBody ProjectDTO dto) {
        // DTO -> Entity
        Project project = BeanUtils.copyProperties(dto, Project.class);
        // Call business logic layer
        Project created = projectService.createProject(project);
        // Entity -> VO
        ProjectVO vo = BeanUtils.copyProperties(created, ProjectVO.class);
        return ApiReturn.of(vo);
    }
}
```
**Design notes**:
* ✅ Keep it thin: HTTP-related logic only
* ✅ Use DTO/VO for data transfer
* ✅ Centralized exception handling
* ❌ No business logic
* ❌ No direct database access
### Business Logic Layer
**Responsibilities**:
* Implement business rules and workflows
* Data validation and business checks
* Authorization and access control
* Transaction management
* Data composition and transformation
* Coordinate multiple services
* Call the data access layer
**Template**:
```java
@Service
@Transactional
public class ProjectService {
    @Resource
    private ProjectMapper projectMapper;
    public Project getProject(Long id) {
        // Business validation
        if (id == null || id <= 0) {
            throw new BusinessException("Invalid project ID");
        }
        // Query data
        Project project = projectMapper.getById(id);
        // Business validation
        if (project == null) {
            throw new BusinessException("Project does not exist");
        }
        // Permission check
        User currentUser = userService.getCurrentUser();
        if (!hasPermission(currentUser, project)) {
            throw new ForbiddenException("Access denied");
        }
        return project;
    }
    public Project createProject(Project project) {
        // Business validation
        if (project.getCustomerId() == null) {
            throw new BusinessException("Customer ID must not be null");
        }
        // Business processing
        project.setCreatedTime(LocalDateTime.now());
        project.setCreatedBy(userService.getCurrentUserId());
        project.setStatus(ProjectStatus.CREATED);
        project.setIsDeleted(false);
        // Persist
        return projectMapper.insert(project);
    }
}
```
**Design notes**:
* ✅ Contains core business logic
* ✅ Use `@Transactional` for transactions
* ✅ Perform business validations
* ✅ Orchestrate multiple services and mappers
* ❌ No HTTP concerns
* ❌ No direct DB connection operations
* ❌ Do not return DTOs (return Entity or VO)
### Data Access Layer
**Responsibilities**:
* Define data access interfaces
* Provide CRUD abstractions
* Abstract data sources (DB, cache, API, etc.)
* Encapsulate persistence details
* Provide aggregate query interfaces
* Do not care about concrete SQL implementations
**Template (MyBatis)**:
```java
public interface ProjectMapper {
    /**
     * Get a project by ID
     */
    Project getById(Long id);
    /**
     * Query all projects
     */
    List<Project> getAll();
    /**
     * Insert a project
     */
    int insert(Project project);
    /**
     * Update a project
     */
    int update(Project project);
    /**
     * Soft delete a project
     */
    int softDelete(Long id);
    /**
     * Count projects
     */
    long count();
}
/**
 * Aggregate query interface (avoid N+1 issues)
 */
public interface ProjectInfoMapper {
    /**
     * Get full project information (including customer, versions, users, etc.)
     */
    ProjectInfoVO getProjectInfo(Long projectId);
}
```
**Template (JPA)**:
```java
/**
 * Project repository interface
 */
public interface ProjectRepository extends JpaRepository<Project, Long> {
    /**
     * Find projects by customer ID
     */
    List<Project> findByCustomerId(Long customerId);
    /**
     * Find projects by status
     */
    List<Project> findByStatus(ProjectStatus status);
    /**
     * Paginated query
     */
    Page<Project> findByIsDeletedFalse(Pageable pageable);
}
```
**Design notes**:
* ✅ Define interfaces only; no concrete implementations
* ✅ Method names clearly express intent
* ✅ Provide aggregate queries to avoid N+1
* ❌ No SQL statements here
* ❌ No business logic
* ❌ No transaction management
* ❌ Must not depend on the Service layer
### Persistence Layer
**Responsibilities**:
* Execute SQL statements
* Manage database connections
* Result mapping (ORM)
* Transaction boundary enforcement
* Handle database-specific syntax
* Performance tuning (indexes, caching, etc.)
**Template (MyBatis XML)**:
```xml
<mapper namespace="com.example.mapper.ProjectMapper">
    <!-- Result mapping -->
    <resultMap id="BaseResultMap" type="com.example.entity.Project">
        <id column="id" property="id" jdbcType="BIGINT"/>
        <result column="created_time" property="createdTime" jdbcType="TIMESTAMP"/>
        <result column="customer_id" property="customerId" jdbcType="BIGINT"/>
        <result column="status" property="status" jdbcType="VARCHAR"/>
    </resultMap>
    <!-- SQL fragments -->
    <sql id="Base_Column_List">
        id, created_time, updated_time, customer_id, customer_company,
        product_version, status
    </sql>
    <!-- Select one -->
    <select id="getById" parameterType="java.lang.Long" resultMap="BaseResultMap">
        SELECT <include refid="Base_Column_List"/>
        FROM project
        WHERE id = #{id}
    </select>
    <!-- Insert -->
    <insert id="insert" useGeneratedKeys="true" keyProperty="id">
        INSERT INTO project (customer_company, status)
        VALUES (#{customerCompany}, #{status})
    </insert>
    <!-- Update -->
    <update id="update" parameterType="com.example.entity.Project">
        UPDATE project
        <set>
            <if test="customerCompany != null">customer_company = #{customerCompany},</if>
            <if test="status != null">status = #{status},</if>
            updated_time = NOW()
        </set>
        WHERE id = #{id}
    </update>
</mapper>
```
**Design notes**:
* ✅ Focus on SQL authoring and optimization
* ✅ Handle database-specific syntax
* ✅ Result mapping and type conversion
* ✅ Use SQL fragments for reusability
* ✅ Use dynamic SQL for complex queries
* ❌ No business logic
* ❌ No business validations
* ❌ Do not return DTOs (return Entity)
### Database Layer
**Responsibilities**:
* Persistent storage
* Data integrity constraints
* Indexes and performance optimization
* Transaction support
* Backup and recovery
**Template (MySQL)**:
```sql
-- Project table
CREATE TABLE project (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'Primary key',
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated time',
    customer_id BIGINT NOT NULL COMMENT 'Customer ID',
    customer_company VARCHAR(200) NOT NULL COMMENT 'Customer company',
    status VARCHAR(50) DEFAULT 'CREATED' COMMENT 'Project status',
    is_deleted TINYINT DEFAULT 0 COMMENT 'Deletion flag',
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Project table';
```
## Data Transfer Patterns
### Using DTO, VO, and Entity
```
Frontend → Controller → Service → Mapper → Database
           ↑ DTO       ↑ Entity   ↑ Entity
           ↑ VO        ↑ Entity   ↑
```
### Conversion Example
```java
// Controller receives DTO
@PostMapping("/projects")
public ApiReturn<ProjectVO> createProject(@RequestBody ProjectDTO dto) {
    // DTO -> Entity
    Project project = BeanUtils.copyProperties(dto, Project.class);
    // Call Service (Entity in)
    Project created = projectService.createProject(project);
    // Entity -> VO
    ProjectVO vo = BeanUtils.copyProperties(created, ProjectVO.class);
    // Return VO
    return ApiReturn.of(vo);
}
```
## Exception Handling
### Centralized Exception Handling
```java
// 1. Custom business exception
public class BusinessException extends RuntimeException {
    private int code;
    private String message;
    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }
}
// 2. Service throws business exception
@Service
public class ProjectService {
    public Project getProject(Long id) {
        Project project = projectMapper.getById(id);
        if (project == null) {
            throw new BusinessException(404, "Project does not exist");
        }
        return project;
    }
}
// 3. Global exception handler in Controller layer
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    public ApiReturn<Void> handleBusinessException(BusinessException e) {
        return ApiReturn.error(e.getCode(), e.getMessage());
    }
    @ExceptionHandler(Exception.class)
    public ApiReturn<Void> handleException(Exception e) {
        log.error("System error", e);
        return ApiReturn.error(500, "Internal server error");
    }
}
```
## Common Pitfalls
### Pitfall 1: Cross-Layer Calls
```java
// ❌ Incorrect: Controller directly calls Mapper
@RestController
public class ProjectController {
    @Resource
    private ProjectMapper projectMapper;  // direct dependency on Mapper
    public List<Project> getProjects() {
        return projectMapper.getAll();  // cross-layer invocation, bypasses Service
    }
}
// Issues:
// 1. Bypasses the business logic layer
// 2. No business validation
// 3. No authorization checks
// 4. Violates layering principles
```
### Pitfall 2: Reverse Dependency
```java
// ❌ Incorrect: Service depends on Controller
@Service
public class ProjectService {
    @Resource
    private ProjectController projectController;  // reverse dependency
    public Project getProject(Long id) {
        // ...
    }
}
// Issues:
// 1. Violates unidirectional dependency
// 2. Creates circular dependencies
// 3. Reduces testability and maintainability
```
### Pitfall 3: Business Logic Leaking into Lower Layers
```xml
<!-- ❌ Incorrect: Business logic embedded in SQL -->
<select id="getById" resultMap="BaseResultMap">
    SELECT * FROM project
    WHERE id = #{id}
      AND is_deleted = 0
      <!-- Business logic: permission checks -->
      AND (
        created_by = #{currentUserId}
        OR has_permission(#{currentUserId}, id)
      )
</select>
<!-- Issues:
     1. Business rules become scattered
     2. Harder to maintain
     3. SQL is less reusable
     4. Authorization logic should live in the Service layer
-->
```
### Pitfall 4: Returning Entity Directly
```java
// ❌ Incorrect: Controller returns Entity directly
@GetMapping("/projects/{id}")
public Project getProject(@PathVariable Long id) {
    return projectService.getProject(id);  // returns Entity
}
// Issues:
// 1. Exposes database schema
// 2. Security risk (sensitive fields leakage)
// 3. Hard to control response fields
// 4. Difficult API versioning
```
## Best Practices Summary
### Presentation Layer
* ✅ Keep it thin: HTTP logic only
* ✅ Use DTO/VO for data transfer
* ✅ Centralized exception handling
* ❌ No business logic
* ❌ No direct Mapper access
### Business Logic Layer
* ✅ Contains core business logic
* ✅ Use `@Transactional` to manage transactions
* ✅ Orchestrate multiple services
* ❌ No HTTP concerns
* ❌ No direct database connection handling
### Data Access Layer
* ✅ Interfaces only
* ✅ Clear method naming
* ✅ Provide aggregate queries
* ❌ No SQL statements
* ❌ No business logic
### Persistence Layer
* ✅ Focus on SQL authoring
* ✅ Use SQL fragments
* ✅ Use dynamic SQL for complex queries
* ❌ No business logic
* ❌ No business validations
### Cross-Layer Communication
* ✅ Controller ← DTO
* ✅ Service ← Entity
* ✅ Mapper ← Entity
* ✅ Controller ← VO
* ❌ Avoid cross-layer calls
* ❌ Avoid reverse dependencies