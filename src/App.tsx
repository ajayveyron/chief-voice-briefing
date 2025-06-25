
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import DataTab from './components/DataTab';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto p-4">
            <Routes>
              <Route path="/" element={
                <Card className="w-full">
                  <CardContent className="p-6">
                    <Tabs defaultValue="dashboard" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                        <TabsTrigger value="data">Data</TabsTrigger>
                      </TabsList>
                      <TabsContent value="dashboard" className="mt-6">
                        <Dashboard />
                      </TabsContent>
                      <TabsContent value="chat" className="mt-6">
                        <ChatInterface />
                      </TabsContent>
                      <TabsContent value="data" className="mt-6">
                        <DataTab />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              } />
            </Routes>
          </div>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
