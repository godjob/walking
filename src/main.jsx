import React from 'react'
import ReactDOM from 'react-dom/client'
import { APIProvider } from '@vis.gl/react-google-maps';
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <APIProvider apiKey="AIzaSyDmVWeNkaqts5QAqjlSqnlUNhR1HT7Vp38">
      <App />
    </APIProvider>
  </React.StrictMode>,
)
