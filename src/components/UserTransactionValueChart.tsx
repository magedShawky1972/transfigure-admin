import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserTransactionValueChartProps {
  data: Array<{
    name: string;
    value: number;
    percentage: number;
    type?: 'point' | 'sales';
  }>;
  language: string;
  loading?: boolean;
}

const SALES_COLORS = ['#9b87f5', '#7E69AB', '#6E59A5', '#D6BCFA', '#8B5CF6', '#A78BFA', '#E5DEFF', '#F1F0FB'];
const POINT_COLOR = '#F59E0B'; // Amber for points

const getItemColor = (type?: 'point' | 'sales', index?: number) => {
  if (type === 'point') {
    return POINT_COLOR;
  }
  return SALES_COLORS[(index || 0) % SALES_COLORS.length];
};

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percentage,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="font-bold text-sm"
    >
      {`${percentage.toFixed(1)}%`}
    </text>
  );
};

export const UserTransactionValueChart = ({ data, language, loading }: UserTransactionValueChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate totals for sales vs points
  const salesTotal = data.filter(d => d.type !== 'point').reduce((sum, item) => sum + item.value, 0);
  const pointsTotal = data.filter(d => d.type === 'point').reduce((sum, item) => sum + item.value, 0);

  // Track sales index for consistent coloring
  let salesIndex = 0;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {language === 'ar' ? 'قيمة المعاملات حسب المستخدم' : 'Transaction Value by User'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">
              {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
            </div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => {
                    const color = getItemColor(entry.type, entry.type === 'point' ? 0 : salesIndex);
                    if (entry.type !== 'point') salesIndex++;
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${language === 'ar' ? 'ر.س' : 'SAR'}`,
                    ''
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => {
                    const item = data.find(d => d.name === value);
                    if (!item) return value;
                    return `${value} (${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
              {(() => {
                let renderSalesIndex = 0;
                return data.map((item, index) => {
                  const color = getItemColor(item.type, item.type === 'point' ? 0 : renderSalesIndex);
                  if (item.type !== 'point') renderSalesIndex++;
                  
                  return (
                    <div key={item.name} className={`flex items-center justify-between p-2 rounded-lg ${item.type === 'point' ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium">{item.name}</span>
                        {item.type === 'point' && (
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300">
                            <Coins className="h-3 w-3 mr-1" />
                            {language === 'ar' ? 'نقاط' : 'Points'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.percentage.toFixed(1)}% {language === 'ar' ? 'من الإجمالي' : 'of total'}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              
              {/* Summary rows for Sales vs Points */}
              {pointsTotal > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 font-semibold border border-amber-300/50">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-600" />
                    <span>{language === 'ar' ? 'إجمالي النقاط' : 'Total Points'}</span>
                  </div>
                  <span>{pointsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-semibold border border-primary/20">
                <span>{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</span>
                <span>{salesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-bold border-2 border-primary/20">
                <span>{language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}</span>
                <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
