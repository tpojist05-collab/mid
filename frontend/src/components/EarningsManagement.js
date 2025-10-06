import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Smartphone, Banknote, Globe } from 'lucide-react';

const EarningsManagement = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [monthlyEarnings, setMonthlyEarnings] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchEarningsData();
  }, [selectedYear]);

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch earnings summary
      const summaryResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/earnings/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEarningsSummary(summaryResponse.data);

      // Fetch monthly earnings for selected year
      const monthlyResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/earnings/monthly?year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMonthlyEarnings(monthlyResponse.data);

    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setError('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const getYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  };

  const getPaymentMethodIcon = (method) => {
    const iconMap = {
      cash: <Banknote className="w-4 h-4" />,
      upi: <Smartphone className="w-4 h-4" />,
      card: <CreditCard className="w-4 h-4" />,
      online: <Globe className="w-4 h-4" />
    };
    return iconMap[method] || <DollarSign className="w-4 h-4" />;
  };

  const getPaymentMethodColor = (method) => {
    const colorMap = {
      cash: 'bg-green-100 text-green-800',
      upi: 'bg-blue-100 text-blue-800', 
      card: 'bg-purple-100 text-purple-800',
      online: 'bg-orange-100 text-orange-800'
    };
    return colorMap[method] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Earnings</h1>
        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getYears().map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchEarningsData} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          <TabsTrigger value="breakdown">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          {earningsSummary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Yearly Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(earningsSummary.yearly_total)}</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedYear} total earnings
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Month</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(earningsSummary.current_month_total)}</div>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString('en-US', { month: 'long' })} earnings
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                    {earningsSummary.growth_percentage >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      earningsSummary.growth_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {earningsSummary.growth_percentage >= 0 ? '+' : ''}{earningsSummary.growth_percentage}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      vs. previous month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Previous Month</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(earningsSummary.previous_month_total)}</div>
                    <p className="text-xs text-muted-foreground">
                      Last month earnings
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Method Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method Distribution ({selectedYear})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(earningsSummary.payment_method_breakdown).map(([method, amount]) => (
                      <div key={method} className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${getPaymentMethodColor(method)}`}>
                          {getPaymentMethodIcon(method)}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{method}</p>
                          <p className="text-sm text-gray-600">{formatCurrency(amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Earnings - {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyEarnings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No earnings data available for {selectedYear}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyEarnings.map((earning) => (
                    <div key={`${earning.year}-${earning.month}`} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{earning.month_name} {earning.year}</h4>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(earning.total_earnings)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {earning.total_payments} payments
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Cash</p>
                          <p className="font-medium">{formatCurrency(earning.cash_earnings)}</p>
                          <p className="text-xs text-gray-500">({earning.cash_payments} payments)</p>
                        </div>
                        <div>
                          <p className="text-gray-600">UPI</p>
                          <p className="font-medium">{formatCurrency(earning.upi_earnings)}</p>
                          <p className="text-xs text-gray-500">({earning.upi_payments} payments)</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Card</p>
                          <p className="font-medium">{formatCurrency(earning.card_earnings)}</p>
                          <p className="text-xs text-gray-500">({earning.card_payments} payments)</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Online</p>
                          <p className="font-medium">{formatCurrency(earning.online_earnings)}</p>
                          <p className="text-xs text-gray-500">({earning.online_payments} payments)</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-6">
          {earningsSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(earningsSummary.payment_method_breakdown).map(([method, amount]) => {
                const percentage = earningsSummary.yearly_total > 0 
                  ? ((amount / earningsSummary.yearly_total) * 100).toFixed(1)
                  : 0;
                
                return (
                  <Card key={method}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium capitalize">
                        {method} Payments
                      </CardTitle>
                      <div className={`p-2 rounded-lg ${getPaymentMethodColor(method)}`}>
                        {getPaymentMethodIcon(method)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(amount)}</div>
                      <div className="flex items-center space-x-2 mt-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${getPaymentMethodColor(method)}`}>
                          {percentage}% of total
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              method === 'cash' ? 'bg-green-500' :
                              method === 'upi' ? 'bg-blue-500' :
                              method === 'card' ? 'bg-purple-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EarningsManagement;