<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Log extends Model
{
    protected $fillable = ['action', 'table_name', 'ancienne_valeur', 'nouvelle_valeur', 'ip_adresse', 'user_id'];

    public function user() { return $this->belongsTo(User::class); }
}