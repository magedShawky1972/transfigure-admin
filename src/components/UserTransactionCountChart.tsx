import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface UserTransactionCountChartProps {
  data: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  language: string;
  loading?: boolean;
}

const COLORS = ['#9b87f5', '#7E69AB', '#6E59A5', '#D6BCFA', '#E5DEFF', '#F1F0FB', '#8B5CF6', '#A78BFA'];

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

export const UserTransactionCountChart = ({ data, language, loading }: UserTransactionCountChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {language === 'ar' ? 'عدد المعاملات حسب المستخدم' : 'Transaction Count by User'}
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
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString()} ${language === 'ar' ? 'معاملة' : 'transactions'}`,
                    ''
                  ]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => {
                    const item = data.find(d => d.name === value);
                    if (!item) return value;
                    return `${value} (${item.value.toLocaleString()})`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{item.value.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.percentage.toFixed(1)}% {language === 'ar' ? 'من الإجمالي' : 'of total'}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 font-bold border-2 border-primary/20">
                <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                <span>{total.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
