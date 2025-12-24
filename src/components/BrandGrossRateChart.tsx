import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';

interface BrandGrossData {
  brand_name: string;
  total_revenue: number;
  total_profit: number;
  gross_rate: number;
}

const VIBRANT_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#A855F7', // Violet
  '#22C55E', // Green
  '#0EA5E9', // Sky
  '#E11D48', // Rose
  '#FACC15', // Yellow
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
        .filter(item => item.total_revenue > 0)
        .sort((a, b) => b.gross_rate - a.gross_rate)
        .slice(0, 20);

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
        <div className="bg-card border border-border rounded-xl p-4 shadow-xl">
          <p className="font-bold text-foreground text-lg mb-2">{item.brand_name}</p>
          <div className="space-y-1">
            <p className="text-sm flex justify-between gap-4">
              <span className="text-muted-foreground">{isRTL ? 'معدل الربح' : 'Gross Rate'}:</span>
              <span className="font-bold text-emerald-500">{item.gross_rate}%</span>
            </p>
            <p className="text-sm flex justify-between gap-4">
              <span className="text-muted-foreground">{isRTL ? 'الإيرادات' : 'Revenue'}:</span>
              <span className="font-semibold">{item.total_revenue.toLocaleString()} SAR</span>
            </p>
            <p className="text-sm flex justify-between gap-4">
              <span className="text-muted-foreground">{isRTL ? 'الربح' : 'Profit'}:</span>
              <span className="font-semibold text-emerald-500">{item.total_profit.toLocaleString()} SAR</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
            <Skeleton className="h-7 w-64 bg-slate-700" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[500px] w-full bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const chartHeight = Math.max(500, data.length * 32);

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-white text-xl">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
          </div>
          {isRTL ? 'معدل النمو (آخر 3 أشهر)' : 'Growth Rate (Last 3 Months)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-slate-400">
            {isRTL ? 'لا توجد بيانات متاحة' : 'No data available'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={data}
                layout="vertical"
                margin={isRTL 
                  ? { top: 10, right: 120, left: 40, bottom: 10 }
                  : { top: 10, right: 40, left: 120, bottom: 10 }
                }
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 'dataMax']}
                  tickFormatter={(value) => `${value}%`}
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#475569' }}
                  reversed={isRTL}
                />
                <YAxis 
                  type="category" 
                  dataKey="brand_name" 
                  width={110}
                  tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 500 }}
                  axisLine={{ stroke: '#475569' }}
                  tickLine={false}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar 
                  dataKey="gross_rate" 
                  radius={[0, 6, 6, 0]}
                  barSize={22}
                >
                  {data.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]}
                      className="drop-shadow-lg"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandGrossRateChart;
