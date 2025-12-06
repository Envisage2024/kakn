# KAKN Sites - Online Learning Platform

A comprehensive online learning platform built with HTML, CSS, and JavaScript featuring a clean blue and white theme with responsive design for all screen sizes.

## Features

### Authentication
- Login page with user authentication
- Session management using local storage
- Remember me functionality

### Dashboard
- Course completion percentage
- Pending assignments counter
- New video tutorials counter
- New PDF notes counter
- New messages counter
- Recent activity timeline
- Upcoming sessions calendar

### Assignments
- Filter by status (Pending/Completed/Reviewed)
- Assignment cards with deadlines
- Submit assignments
- View feedback and grades

### Live Sessions
- Session status indicator
- Join meeting button (opens in new tab)
- Upcoming sessions list
- Set reminders for sessions

### Video Tutorials
- Grid layout of video tutorials
- Video duration display
- New video badges
- View counts and upload dates

### PDF Notes
- Downloadable course notes
- View and download functionality
- File size and date information
- New notes indicators

### One-on-One Support
- Direct messaging with tutor
- Real-time chat interface
- Message history
- File attachment support (placeholder)

### Group Forum
- Discussion threads
- Community engagement
- Placeholder for group chat integration

### Certificate
- Digital certificate of completion
- Dynamic name population from user profile
- Download certificate functionality
- Share on social media (LinkedIn, Facebook, Twitter)
- Preview certificate design

### Notifications
- Admin notifications
- Assignment reminders
- New content alerts
- Mark as read functionality

## Design Features

- **Blue and White Theme**: Clean, professional color scheme
- **Collapsible Sidebar**: Expandable navigation menu
- **Responsive Layout**: Mobile-friendly design for all screen sizes
- **Smooth Animations**: Modern transitions and hover effects
- **Icon Integration**: Font Awesome icons throughout
- **Card-based UI**: Modern card layouts for content

## Technology Stack

- **HTML5**: Semantic markup
- **CSS3**: Flexbox, Grid, animations
- **JavaScript (ES6+)**: Vanilla JavaScript
- **Local Storage API**: Client-side data persistence
- **Font Awesome**: Icon library
- **Google Fonts**: Inter font family

## Getting Started

1. Open `index.html` in your web browser or access via the web server
2. Use any email and password to login (demo mode)
3. Explore all the features across different pages
4. Data is stored in browser's local storage

## Default Login

For testing purposes, you can use any email and password combination. The system will automatically create a demo user profile.

## File Structure

```
├── index.html              # Login page
├── dashboard.html          # Main dashboard
├── assignments.html        # Assignments page
├── live-sessions.html      # Live sessions
├── video-tutorials.html    # Video tutorials
├── notes.html              # PDF notes
├── support.html            # One-on-one messaging
├── forum.html              # Group forum
├── certificate.html        # Certificate page
├── notifications.html      # Notifications
├── css/
│   └── style.css          # Main stylesheet
├── js/
│   ├── auth.js            # Authentication logic
│   ├── main.js            # Core functionality
│   ├── dashboard.js       # Dashboard specific
│   ├── assignments.js     # Assignments filtering
│   ├── live-sessions.js   # Live sessions
│   ├── video-tutorials.js # Video tutorials
│   ├── notes.js           # PDF notes
│   ├── support.js         # Messaging
│   ├── forum.js           # Forum
│   ├── certificate.js     # Certificate
│   └── notifications.js   # Notifications
└── README.md              # This file
```

## Responsive Breakpoints

- **Desktop**: 1024px and above
- **Tablet**: 768px - 1023px
- **Mobile**: Below 768px

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Opera

## Future Enhancements

- Backend API integration
- Real-time messaging with WebSocket
- Video conferencing integration
- File upload functionality
- Admin panel
- Database integration
- Email notifications
- Progress tracking analytics

## License

Created for KAKN Sites Learning Platform

## Contact

For support and inquiries, contact the KAKN Sites team.
