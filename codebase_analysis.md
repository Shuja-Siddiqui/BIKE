# BIKE Codebase Analysis

## Overview

BIKE (v0.1) is a **conversation-driven computing environment** where chat interactions create and manage persistent artifacts. It's a unique approach that eliminates traditional app interfaces in favor of natural language commands that generate, modify, and display content.

## Core Philosophy

- **No traditional apps** - Everything is done through conversation
- **Artifacts as memory** - Persistent content units created through chat
- **Single view focus** - One thing displayed at a time with smooth transitions
- **Chat as the universal interface** - No separate modes or complex UI

## Architecture Overview

The system follows a **reactive flow architecture**:

```
[User Input] → [Process] → [Orchestrate] → [Actions/Artifacts] → [Views] → [Memory/Sync]
     ↑                                                                        ↓
[Context] ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←← [Storage]
```

## Key Components

### 1. Input System (`input.js`)
**Purpose**: Captures and processes user input

**Key Features**:
- Global keyboard listener for instant access anywhere
- Visual interface with context highlighting
- File upload support for documents, images, PDFs
- Animated placeholder text and smooth UI transitions
- Event handling for typing, submission, and navigation

**How it works**:
- Creates a persistent input element that's always accessible
- Processes user messages and forwards them to the Process module
- Handles file uploads by converting them to structured data
- Provides visual feedback and context highlighting

### 2. Process System (`process/`)
**Purpose**: AI communication and content generation

**Core Files**:
- `process.js` - Main AI communication logic
- `process-content.js` - Content type detection and generation
- `process-image.js` - Image generation via DALL-E

**How it works**:
- Communicates with OpenAI's GPT-4 and DALL-E APIs
- Uses structured prompts to generate JSON responses
- Handles different content types (text, code, images, structured data)
- Provides context-aware responses based on current app state

### 3. Orchestration (`orchestrate.js`)
**Purpose**: Coordinates AI responses into system actions

**Key Responsibilities**:
- Interprets AI responses (both JSON structured and plain text)
- Decides whether to create new artifacts or update existing ones
- Coordinates between different system modules
- Handles artifact matching and content enhancement

**How it works**:
- Receives AI responses from the Process module
- Parses structured JSON responses for artifact creation
- Uses specialized content modules for type-specific processing
- Triggers appropriate actions based on response content

### 4. Actions System (`actions.js`)
**Purpose**: Central registry of all system commands

**Key Features**:
- Comprehensive action catalog (1800+ lines)
- Action tracking and history
- Standardized result formatting
- Actions organized by categories: Chat, Artifacts, Views, Auth

**Action Categories**:
- **Chat actions**: Create, switch, merge conversations
- **Artifact actions**: Create, update, delete content
- **View actions**: Switch between different display modes
- **Auth actions**: User authentication and preferences

### 5. Artifacts System (`artifacts.js`)
**Purpose**: Core content management

**Artifact Types**:
- **Text** - Documents, notes, plain text
- **HTML** - Web pages, interactive content
- **Markdown** - Formatted documents with syntax highlighting
- **Images** - Generated or uploaded visuals
- **Links** - External URLs with metadata
- **Files** - Uploaded documents with processing

**How it works**:
- Each artifact has a unique ID and versioning system
- Content is stored with metadata (title, type, timestamps)
- Artifacts are associated with specific chats
- Live URLs are generated for sharing and embedding

### 6. Views System (`views/`)
**Purpose**: Display layer for different content types

**View Types**:
- `view-chat.js` - Chat interface display
- `view-artifact.js` - Single artifact display
- `view-artifacts.js` - Grid view of multiple artifacts
- `view-calendar.js` - Timeline-based organization
- `view-memory.js` - System state visualization

**How it works**:
- Each view is registered with metadata and render functions
- Views adapt to content type and screen size
- Smooth transitions between different view modes
- Always maintains one active view at a time

### 7. Context System (`context/`)
**Purpose**: State management and conversation tracking

**Core Components**:
- `context.js` - Main state management
- `context-highlight.js` - UI highlighting and visual feedback

**State Structure**:
```javascript
{
  chats: [],              // All conversations
  messagesByChat: {},     // Messages organized by chat ID
  artifacts: [],          // All created artifacts
  activeChatId: null,     // Current conversation
  activeView: null,       // Current display mode
  userPreferences: {}     // User settings and preferences
}
```

### 8. Memory & Sync (`memory.js`, `sync.js`)
**Purpose**: Data persistence and synchronization

**Memory System**:
- Local storage with debounced saves (500ms delay)
- Automatic state persistence across sessions
- Optimized storage with cleanup of old data

**Sync System**:
- Cloud synchronization via Supabase
- Offline-first architecture with conflict resolution
- Real-time collaboration support
- Automatic backups and consistency checks

### 9. User System (`user.js`)
**Purpose**: Authentication and user management

**Features**:
- Email-based authentication via Supabase
- User preferences and settings
- Organization and role support
- Session management with automatic refresh

## Data Flow

### 1. User Interaction Flow
```
User types message → Input captures → Process sends to AI → AI responds → 
Orchestrate interprets → Actions execute → Artifacts created/updated → 
Views render → Memory persists → Sync uploads
```

### 2. Artifact Creation Flow
```
User: "Create a todo list"
↓
Process: Sends structured prompt to GPT-4
↓
AI Response: JSON with artifact data
↓
Orchestrate: Parses response, determines artifact type
↓
Actions: Executes createArtifact action
↓
Artifacts: Creates new artifact with content
↓
Views: Renders artifact in appropriate view
↓
Memory: Saves to localStorage
↓
Sync: Uploads to cloud storage
```

### 3. View Switching Flow
```
User: "Show me the calendar"
↓
Actions: Executes switchView action
↓
Views: Determines best view for content
↓
Context: Updates activeView state
↓
UI: Smooth transition animation
↓
View renders: Calendar view with chat data
```

## Technical Implementation

### Technology Stack
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Storage**: localStorage + Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4 and DALL-E APIs
- **Styling**: Custom CSS system (rene/)
- **Authentication**: Supabase Auth

### Performance Optimizations
- Debounced localStorage saves (500ms)
- Lazy loading of large content
- Efficient state updates with partial modifications
- Background sync with retry logic
- Memory cleanup for action history

### Error Handling
- Graceful degradation for offline usage
- Retry logic with exponential backoff
- Clear error messages with suggested actions
- Automatic recovery for common failure scenarios
- Comprehensive logging for debugging

## Key Innovations

### 1. Conversation-Driven Architecture
Unlike traditional apps with menus and buttons, BIKE uses natural language as the primary interface. This creates a more intuitive and flexible user experience.

### 2. Artifact-Centric Design
Instead of files or documents, content is organized as "artifacts" - persistent units that can be referenced, modified, and shared through conversation.

### 3. Context-Aware AI
The AI system has access to full application context, enabling it to make intelligent decisions about content creation and modification.

### 4. Single-View Philosophy
By showing only one thing at a time, the interface remains clean and focused, reducing cognitive load and improving user concentration.

## Extensibility

The system is designed for easy extension:
- **New artifact types**: Add to content detection logic
- **New views**: Register in views system with render functions
- **New actions**: Add to actions registry with metadata
- **New AI capabilities**: Extend process modules

## Security Considerations

- API keys stored in config.js (not in repository)
- User authentication through Supabase
- Content sanitization for HTML artifacts
- Secure cloud sync with encrypted storage
- Rate limiting for AI API calls

## Summary

BIKE represents a novel approach to computing interfaces, where conversation becomes the universal method for creating, managing, and displaying content. The architecture is carefully designed to be modular, extensible, and focused on the core philosophy of "no apps, just flow" - creating a seamless experience where users can accomplish complex tasks through simple, natural language interactions.