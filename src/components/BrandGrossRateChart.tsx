import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

interface BrandGrossData {
  brand_name: string;
  total_revenue: number;
  total_profit: number;
  gross_rate: number;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(340, 70%, 50%)',
  'hsl(60, 70%, 50%)',
  'hsl(180, 70%, 50%)',
];

export const BrandGrossRateChart = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BrandGrossData[]>([]);

  useEffect(() => {
    fetchGrossRateData();
  }, []);

  const fetchGrossRateData = async () => {
    try {
      setLoading(true);
      
      // Calculate date 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

      const { data: transactions, error } = await supabase
        .from('purpletransaction')
        .select('brand_name, total, profit')
        .gte('created_at_date', threeMonthsAgoStr)
        .eq('is_deleted', false)
        .not('brand_name', 'is', null)
        .not('total', 'is', null);

      if (error) throw error;

      // Group by brand and calculate gross rate
      const brandMap = new Map<string, { revenue: number; profit: number }>();

      transactions?.forEach((t) => {
        const brandName = t.brand_name || 'Unknown';
        const current = brandMap.get(brandName) || { revenue: 0, profit: 0 };
        current.revenue += Number(t.total) || 0;
        current.profit += Number(t.profit) || 0;
        brandMap.set(brandName, current);
      });

      // Convert to array and calculate gross rate percentage
      const result: BrandGrossData[] = Array.from(brandMap.entries())
        .map(([brand_name, values]) => ({
          brand_name,
          total_revenue: values.revenue,
          total_profit: values.profit,
          gross_rate: values.revenue > 0 
            ? Number(((values.profit / values.revenue) * 100).toFixed(2))
            : 0
        }))
        .filter(item => item.total_revenue > 0) // Only include brands with revenue
        .sort((a, b) => b.gross_rate - a.gross_rate) // Sort by gross rate descending
        .slice(0, 15); // Top 15 brands

      setData(result);
    } catch (error) {
      console.error('Error fetching gross rate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isRTL = language === 'ar';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as BrandGrossData;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{item.brand_name}</p>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'معدل الربح الإجمالي' : 'Gross Rate'}: 
            <span className="font-medium text-primary ml-1">{item.gross_rate}%</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'الإيرادات' : 'Revenue'}: 
            <span className="font-medium ml-1">{item.total_revenue.toLocaleString()} SAR</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'الربح' : 'Profit'}: 
            <span className="font-medium ml-1">{item.total_profit.toLocaleString()} SAR</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {isRTL ? 'معدل الربح الإجمالي للعلامات التجارية (3 أشهر)' : 'Brand Gross Rate (Last 3 Months)'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            {isRTL ? 'لا توجد بيانات متاحة' : 'No data available'}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  type="number" 
                  domain={[0, 'dataMax']}
                  tickFormatter={(value) => `${value}%`}
                  className="text-muted-foreground"
                />
                <YAxis 
                  type="category" 
                  dataKey="brand_name" 
                  width={90}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={() => isRTL ? 'معدل الربح الإجمالي %' : 'Gross Rate %'}
                />
                <Bar 
                  dataKey="gross_rate" 
                  name={isRTL ? 'معدل الربح الإجمالي %' : 'Gross Rate %'}
                  radius={[0, 4, 4, 0]}
                >
                  {data.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Summary Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {isRTL ? 'العلامة التجارية' : 'Brand'}
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                      {isRTL ? 'الإيرادات' : 'Revenue'}
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                      {isRTL ? 'الربح' : 'Profit'}
                    </th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                      {isRTL ? 'معدل الربح %' : 'Gross Rate %'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={item.brand_name} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-3 flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-sm" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {item.brand_name}
                      </td>
                      <td className="text-right py-2 px-3">
                        {item.total_revenue.toLocaleString()} SAR
                      </td>
                      <td className="text-right py-2 px-3">
                        {item.total_profit.toLocaleString()} SAR
                      </td>
                      <td className="text-right py-2 px-3 font-semibold text-primary">
                        {item.gross_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandGrossRateChart;
