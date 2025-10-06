import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';

const LoginForm = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(credentials.username, credentials.password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Demo login removed for security

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-0 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="text-6xl mb-4">💪</div>
          <CardTitle className="text-3xl font-bold text-slate-800">
            Iron Paradise Gym
          </CardTitle>
          <p className="text-slate-600 mt-2">
            Management System Login
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({
                  ...credentials,
                  username: e.target.value
                })}
                placeholder="Enter your username"
                required
                data-testid="login-username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({
                  ...credentials,
                  password: e.target.value
                })}
                placeholder="Enter your password"
                required
                data-testid="login-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Logging in...
                </div>
              ) : (
                'Login'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <div className="text-center mb-3">
              <p className="text-sm text-slate-600">Demo Access</p>
            </div>
            <Button 
              onClick={handleDemoLogin}
              variant="outline"
              className="w-full"
              disabled={loading}
              data-testid="demo-login"
            >
              🚀 Try Demo (Admin Access)
            </Button>
          </div>

          <div className="mt-4 text-center">
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>Demo Credentials:</strong></p>
              <p>Username: <code>admin</code></p>
              <p>Password: <code>admin123</code></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;